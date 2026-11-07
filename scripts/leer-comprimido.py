"""Inspecciona RAR/7z por rangos; nunca escribe archivos del archivo comprimido."""
import base64
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from collections import OrderedDict

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'vendor', 'python'))
import py7zr
import rarfile
from py7zr.io import Py7zIO, WriterFactory

BLOCK = 256 * 1024
LIMIT = 32 * 1024 * 1024
MAX_IMAGE = 5 * 1024 * 1024
MAX_EXTRACT = 48 * 1024 * 1024

class DriveReader(io.RawIOBase):
    def __init__(self, file_id, size, token):
        super().__init__()
        self.file_id, self.length, self.token = file_id, size, token
        self.pos, self.transferred, self.requests = 0, 0, 0
        self.cache = OrderedDict()
        self.start = time.monotonic()

    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos
    def seek(self, offset, whence=0):
        position = offset if whence == 0 else self.pos + offset if whence == 1 else self.length + offset
        if position < 0: raise ValueError('Posición inválida')
        self.pos = position
        return self.pos

    def readinto(self, data):
        content = self.read(len(data))
        data[:len(content)] = content
        return len(content)

    def _block(self, number):
        if number in self.cache:
            self.cache.move_to_end(number)
            return self.cache[number]
        start = number * BLOCK
        end = min(start + BLOCK, self.length) - 1
        expected = end - start + 1
        if expected < 1: return b''
        if self.transferred + expected > LIMIT or self.requests >= 256 or time.monotonic() - self.start > 75:
            raise ValueError('Límite de lectura parcial alcanzado')
        request = urllib.request.Request(
            'https://www.googleapis.com/drive/v3/files/' + self.file_id + '?alt=media&supportsAllDrives=true',
            headers={'Authorization': 'Bearer ' + self.token, 'Range': f'bytes={start}-{end}', 'Accept-Encoding': 'identity'})
        with urllib.request.urlopen(request, timeout=25) as response:
            if response.status != 206 or response.headers.get('Content-Range') != f'bytes {start}-{end}/{self.length}':
                raise ValueError('Drive no aceptó la lectura parcial')
            content = response.read(expected + 1)
            if len(content) != expected: raise ValueError('Lectura parcial incompleta')
        self.transferred += len(content)
        self.requests += 1
        self.cache[number] = content
        while len(self.cache) > 16: self.cache.popitem(last=False)
        return content

    def read(self, count=-1):
        remaining = max(0, self.length - self.pos)
        if count is None or count < 0: count = remaining
        count = min(count, remaining)
        if count > 4 * 1024 * 1024: raise ValueError('Lectura individual demasiado grande')
        parts = []
        while count:
            block_no, within = divmod(self.pos, BLOCK)
            block = self._block(block_no)
            take = min(count, len(block) - within)
            if take <= 0: raise ValueError('Rango inválido')
            parts.append(block[within:within + take])
            self.pos += take
            count -= take
        return b''.join(parts)

class LimitedBuffer(Py7zIO):
    def __init__(self): self.buf = io.BytesIO()
    def write(self, data):
        if self.buf.tell() + len(data) > MAX_IMAGE: raise ValueError('Vista previa demasiado grande')
        return self.buf.write(data)
    def read(self, size=None): return self.buf.read(-1 if size is None else size)
    def seek(self, offset, whence=0): return self.buf.seek(offset, whence)
    def flush(self): pass
    def size(self): return len(self.buf.getbuffer())

class LimitedFactory(WriterFactory):
    def __init__(self): self.items = {}
    def create(self, filename):
        item = LimitedBuffer()
        self.items[filename] = item
        return item

def safe_preview(name):
    name = name.replace('\\', '/')
    return bool(not name.startswith('/') and '\x00' not in name and '..' not in name.split('/') and
                re.search(r'(?:^|/)preview\.(?:jpe?g|png|webp)$', name, re.I))

def image_type(data):
    if data.startswith(b'\xff\xd8\xff'): return 'jpg'
    if data.startswith(b'\x89PNG\r\n\x1a\n'): return 'png'
    if data.startswith(b'RIFF') and data[8:12] == b'WEBP': return 'webp'
    return None

def result(name, data):
    ext = image_type(data)
    if not ext or len(data) > MAX_IMAGE: return None
    return {'entry': name, 'ext': ext, 'data': base64.b64encode(data).decode('ascii')}

def read_7z(reader):
    with py7zr.SevenZipFile(reader, mode='r', max_extract_size=MAX_EXTRACT) as archive:
        if archive.needs_password(): raise ValueError('Archivo 7z protegido con contraseña')
        solid = archive._is_solid()
        files = archive.list()
        if len(files) > 20000: raise ValueError('Demasiados elementos en el archivo')
        if solid:
            # Solo intentamos entradas cercanas al inicio del flujo sólido; la
            # biblioteca limita también los bytes realmente descomprimidos.
            selected, prefix = [], 0
            for item in files:
                size = item.uncompressed or 0
                if size < 0 or prefix + size > MAX_EXTRACT: break
                prefix += size
                if not item.is_directory and safe_preview(item.filename) and 0 < size <= MAX_IMAGE:
                    selected.append(item)
                    if len(selected) >= 6: break
        else:
            matches = [f for f in files if not f.is_directory and safe_preview(f.filename) and 0 < (f.uncompressed or 0) <= MAX_IMAGE]
            matches.sort(key=lambda f: ('/skins/' not in f.filename.replace('\\', '/').lower(), f.filename.lower()))
            selected = matches[:6]
        if not selected: return []
        factory = LimitedFactory()
        archive.extract(targets=[f.filename for f in selected], factory=factory)
        output = []
        for item in selected:
            buffer = factory.items.get(item.filename)
            if buffer:
                value = result(item.filename, buffer.buf.getvalue())
                if value: output.append(value)
        return output

def read_rar(reader):
    if os.name == 'nt':
        rarfile.UNRAR_TOOL = os.path.join(os.environ.get('ProgramFiles', r'C:\Program Files'), 'WinRAR', 'UnRAR.exe')
    rarfile.HACK_TMP_DIR = os.path.join(os.path.dirname(__file__), '..', '.runtime', 'temporales')
    os.makedirs(rarfile.HACK_TMP_DIR, exist_ok=True)
    with rarfile.RarFile(reader) as archive:
        if archive.needs_password(): raise ValueError('Archivo RAR protegido con contraseña')
        if archive.is_solid(): raise ValueError('Archivo RAR sólido: no se revisa sin una lectura potencialmente grande')
        files = archive.infolist()
        if len(files) > 20000: raise ValueError('Demasiados elementos en el archivo')
        parser = archive._file_parser
        if not parser._main or parser._main._must_disable_hack(): raise ValueError('RAR no admite extracción parcial segura')
        matches = [f for f in files if f.is_file() and not f.is_symlink() and not f.file_redir and
                   not f._must_disable_hack() and safe_preview(f.filename) and
                   0 < f.file_size <= MAX_IMAGE and 0 < f.compress_size <= MAX_IMAGE]
        matches.sort(key=lambda f: ('/skins/' not in f.filename.replace('\\', '/').lower(), f.filename.lower()))
        output = []
        for item in matches[:6]:
            with archive.open(item) as stream:
                data = stream.read(MAX_IMAGE + 1)
            value = result(item.filename, data)
            if value: output.append(value)
        return output

def main():
    data = json.load(sys.stdin)
    if not re.fullmatch(r'[\w-]+', data['id']) or not isinstance(data['size'], int) or data['size'] < 1:
        raise ValueError('Datos de archivo inválidos')
    reader = DriveReader(data['id'], data['size'], data['token'])
    if data['type'] == '7z': images = read_7z(reader)
    elif data['type'] == 'rar': images = read_rar(reader)
    else: raise ValueError('Formato no compatible')
    print(json.dumps({'images': images, 'transferred': reader.transferred, 'requests': reader.requests}))

if __name__ == '__main__':
    try: main()
    except Exception as error:
        print(json.dumps({'error': str(error) or type(error).__name__}))
        sys.exit(1)



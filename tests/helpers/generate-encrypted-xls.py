"""Regenerate synthetic BIFF8 streams: python3 tests/helpers/generate-encrypted-xls.py.

Requires Node, the project's SheetJS installation, and OpenSSL 3 with its legacy
provider. Python hashlib derives keys; OpenSSL encrypts both the verifiers and
workbook records. No application code or officecrypto-tool code is imported.

Layouts/algorithms: MS-XLS 2.4.117 and 2.2.10; MS-OFFCRYPTO 2.3.5 and 2.3.6.
The deterministic salts and verifiers are test inputs, not production secrets.
"""

import base64
import hashlib
from pathlib import Path
import struct
import subprocess


def rc4(key, data):
    return subprocess.run(
        ["openssl", "enc", "-rc4", "-provider", "legacy", "-K", key.hex()],
        input=data, capture_output=True, check=True,
    ).stdout


def derive_key(password, salt, block, key_bits):
    password_bytes = password.encode("utf-16le")
    block_bytes = struct.pack("<I", block)
    if key_bits is None:
        initial = hashlib.md5(password_bytes).digest()[:5]
        intermediate = hashlib.md5((initial + salt) * 16).digest()[:5]
        return hashlib.md5(intermediate + block_bytes).digest()
    initial = hashlib.sha1(salt + password_bytes).digest()
    final = hashlib.sha1(initial + block_bytes).digest()
    return final[:5] + bytes(11) if key_bits == 40 else final[:key_bits // 8]


def encrypt_stream(plain, password, key_bits):
    salt = bytes(range(16))
    verifier = bytes(range(16, 32))
    digest = hashlib.md5(verifier).digest() if key_bits is None else hashlib.sha1(verifier).digest()
    encrypted_verifier = rc4(derive_key(password, salt, 0, key_bits), verifier + digest)
    if key_bits is None:
        metadata = struct.pack("<HHH", 1, 1, 1) + salt + encrypted_verifier
    else:
        csp = "Microsoft Enhanced Cryptographic Provider v1.0\0".encode("utf-16le")
        header = struct.pack("<8I", 12, 0, 0x6801, 0x8004, key_bits, 1, 0, 0) + csp
        metadata = struct.pack("<HHHII", 1, 4, 2, 12, len(header)) + header
        metadata += struct.pack("<I", 16) + salt + encrypted_verifier[:16]
        metadata += struct.pack("<I", 20) + encrypted_verifier[16:]
    file_pass = struct.pack("<HH", 47, len(metadata)) + metadata
    bof_end = 4 + struct.unpack_from("<H", plain, 2)[0]
    stream = bytearray(plain[:bof_end] + file_pass + plain[bof_end:])
    # Inserting FilePass shifts every worksheet BOF. BoundSheet8 offsets stay plaintext.
    offset = 0
    encrypted_positions = []
    while offset < len(stream):
        record, size = struct.unpack_from("<HH", stream, offset)
        end = offset + 4 + size
        if record == 133:
            sheet_offset = struct.unpack_from("<I", stream, offset + 4)[0]
            struct.pack_into("<I", stream, offset + 4, sheet_offset + len(file_pass))
        if record not in {2057, 47, 404, 405, 225, 406, 312}:
            encrypted_positions.extend(range(offset + (8 if record == 133 else 4), end))
        offset = end
    encrypted = bytearray()
    for block, start in enumerate(range(0, len(stream), 1024)):
        encrypted.extend(rc4(derive_key(password, salt, block, key_bits), stream[start:start + 1024]))
    for position in encrypted_positions:
        stream[position] = encrypted[position]
    return base64.b64encode(stream).decode()


plain_base64 = subprocess.check_output([
    "node", "--input-type=module", "--eval", """
import * as XLSX from 'xlsx';
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    [null, null, 'Synthetic Dollar (USD)'],
    ['synthetic padding '.repeat(140)],
    [],
    [45663, null, 105, 103, 104],
    [45664, null, 107, 105, 106],
]), 'data');
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    [null, null, 'TTS', 'TTB', 'TTM'],
    ['1月', '高値', 108, 106, 107],
    [null, '安値', 104, 102, 103],
    [null, '平均', 106, 104, 105],
    ['年間', '高値', 110, 108, 109],
    [null, '安値', 102, 100, 101],
    [null, '平均', 106, 104, 105],
]), '月毎');
const bytes = XLSX.write(workbook, { type: 'buffer', bookType: 'biff8' });
const cfb = XLSX.CFB.read(bytes, { type: 'buffer' });
console.log(Buffer.from(cfb.FileIndex.find(entry => entry.name === 'Workbook').content).toString('base64'));
""",
], text=True).strip()
plain = base64.b64decode(plain_base64)
fixtures = {"plain": plain_base64}
for name, key_bits in [("rc4", None), ("cryptoapi40", 40), ("cryptoapi128", 128)]:
    fixtures[name] = encrypt_stream(plain, "VelvetSweatshop", key_bits)
    fixtures[name + "OtherPassword"] = encrypt_stream(plain, "SyntheticOtherPassword", key_bits)
output = Path(__file__).with_name("encrypted-xls.ts")
output.write_text(
    "// Generated synthetic BIFF8 streams; regenerate with generate-encrypted-xls.py.\n"
    "// Python hashlib + OpenSSL 3 RC4, independent of the application's verification.\n"
    "export const encryptedXls = {\n"
    + "".join(f"\t{name}: '{value}',\n" for name, value in fixtures.items())
    + "} as const;\n"
)
print(f"Generated {len(fixtures)} synthetic streams ({len(plain)} plaintext bytes) in {output}")

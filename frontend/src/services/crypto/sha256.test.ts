import { describe, expect, it } from 'vitest';
import { sha256BytesLocal } from './sha256';

const encoder = new TextEncoder();

describe('sha256BytesLocal', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['HiLeS en red', '33913cba638ce514996582793e093568603af4e3c157e98636afef29c40ff423'],
  ])('calcula el vector conocido para %j', (texto, esperado) => {
    expect(sha256BytesLocal(encoder.encode(texto))).toBe(esperado);
  });
});

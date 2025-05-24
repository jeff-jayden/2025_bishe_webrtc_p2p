import CryptoJS from 'crypto-js';

const algorithm = 'AES';
const secretKey = CryptoJS.enc.Utf8.parse('12345678901234567890123456789012'); // 32字节密钥
const iv = CryptoJS.enc.Utf8.parse('1234567890123456'); // 16字节初始化向量

// 加密数据
export const encryptData = async (data) => {
  // 处理ArrayBuffer类型数据
  if (data instanceof ArrayBuffer) {
    data = new Uint8Array(data);
  }
  
  // 处理Uint8Array类型数据
  if (data instanceof Uint8Array) {
    data = CryptoJS.lib.WordArray.create(data);
  } else {
    // 处理字符串类型数据
    data = CryptoJS.enc.Utf8.parse(data);
  }
  
  const encrypted = CryptoJS.AES.encrypt(
    data,
    secretKey,
    {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    }
  );
  return encrypted.toString();
};

// 解密数据
export const decryptData = async (encryptedData) => {
  const decrypted = CryptoJS.AES.decrypt(
    encryptedData,
    secretKey,
    {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    }
  );

  // 返回ArrayBuffer类型数据
  const wordArray = decrypted.words;
  const arrayBuffer = new ArrayBuffer(decrypted.sigBytes);
  const uint8Array = new Uint8Array(arrayBuffer);

  for (let i = 0; i < decrypted.sigBytes; i++) {
    uint8Array[i] = (wordArray[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  }

  return arrayBuffer;
};
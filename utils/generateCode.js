import crypto from "crypto";

const codeLength = () => Math.min(Math.max(Number(process.env.CODE_LENGTH) || 4, 4), 8);

const generateCode = () => {
  const length = codeLength();

  return String(crypto.randomInt(10 ** (length - 1), 10 ** length));
};

export default generateCode;

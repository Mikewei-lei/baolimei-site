import crypto from 'node:crypto';
import { ApiError } from './http';
import { serverEnv } from './env';
import { redactPhone } from './crypto';

function percentEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function aliyunSignature(params: Record<string, string>, secret: string) {
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&');
  const stringToSign = `POST&${percentEncode('/')}&${percentEncode(canonical)}`;
  return crypto.createHmac('sha1', `${secret}&`).update(stringToSign).digest('base64');
}

async function sendAliyunSms(phone: string, code: string, purpose: string) {
  const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID || process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret =
    process.env.ALIYUN_SMS_ACCESS_KEY_SECRET || process.env.ALIYUN_ACCESS_KEY_SECRET;
  const signName = process.env.ALIYUN_SMS_SIGN_NAME || '广州流花科技';
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE;
  if (!accessKeyId || !accessKeySecret || !templateCode) {
    throw new ApiError(503, 'SMS_NOT_CONFIGURED', '阿里云短信缺少 AccessKey 或模板 Code');
  }
  const templateParamName = process.env.ALIYUN_SMS_TEMPLATE_PARAM_NAME || 'code';
  const params: Record<string, string> = {
    AccessKeyId: accessKeyId,
    Action: 'SendSms',
    Format: 'JSON',
    PhoneNumbers: phone,
    RegionId: process.env.ALIYUN_SMS_REGION || 'cn-hangzhou',
    SignName: signName,
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: '1.0',
    TemplateCode: templateCode,
    TemplateParam: JSON.stringify({ [templateParamName]: code }),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    Version: '2017-05-25',
  };
  params.Signature = aliyunSignature(params, accessKeySecret);
  const endpoint = process.env.ALIYUN_SMS_ENDPOINT || 'https://dysmsapi.aliyuncs.com/';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const data = (await response.json().catch(() => ({}))) as {
    Code?: string;
    Message?: string;
    RequestId?: string;
  };
  if (!response.ok || data.Code !== 'OK') {
    console.error(
      `[sms] aliyun failed status=${response.status} code=${data.Code || 'UNKNOWN'} phone=${redactPhone(phone)} request=${data.RequestId || '-'}`
    );
    throw new ApiError(
      502,
      'SMS_DELIVERY_FAILED',
      data.Message || '阿里云短信发送失败，请检查签名和模板配置'
    );
  }
  return { provider: 'aliyun', delivered: true, requestId: data.RequestId };
}

export async function sendVerificationSms(phone: string, code: string, purpose: string) {
  const provider = serverEnv.smsProvider;
  if (!provider) {
    throw new ApiError(503, 'SMS_NOT_CONFIGURED', '短信服务未配置，请联系管理员');
  }

  if (provider === 'console') {
    if (!serverEnv.allowDevSms) {
      throw new ApiError(503, 'SMS_NOT_CONFIGURED', '生产环境禁止使用控制台短信通道');
    }
    console.info(`[sms:dev] ${redactPhone(phone)} purpose=${purpose} code=${code}`);
    return { provider: 'console', delivered: true };
  }

  if (provider === 'aliyun') {
    return sendAliyunSms(phone, code, purpose);
  }

  if (provider === 'http') {
    const url = process.env.SMS_HTTP_URL;
    const token = process.env.SMS_HTTP_TOKEN;
    if (!url || !token) {
      throw new ApiError(503, 'SMS_NOT_CONFIGURED', '短信 HTTP 网关缺少配置');
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        phone,
        code,
        purpose,
        template: process.env.SMS_TEMPLATE_ID || 'login',
      }),
    });
    if (!response.ok) {
      console.error(`[sms] provider failed status=${response.status} phone=${redactPhone(phone)}`);
      throw new ApiError(502, 'SMS_DELIVERY_FAILED', '验证码发送失败，请稍后重试');
    }
    return { provider: 'http', delivered: true };
  }

  throw new ApiError(503, 'SMS_NOT_CONFIGURED', '未知的短信服务类型');
}

#!/usr/bin/env node
// 域名上线自检：绕过本地 DNS 劫持，直接查阿里公共 DNS（DoH），再验证 HTTPS 与备案号展示
// 用法：node scripts/check-domain.mjs [domain]

const domain = process.argv[2] || 'baolimei.cn';
const doh = async (name, type) => {
  const res = await fetch(
    `https://dns.alidns.com/resolve?name=${encodeURIComponent(name)}&type=${type}`,
    { headers: { accept: 'application/dns-json' } }
  );
  const data = await res.json();
  return data.Answer || [];
};

const line = (label, value) => console.log(`${label.padEnd(12)} ${value}`);

(async () => {
  console.log(`\n=== 域名自检：${domain} ===\n`);
  for (const [name, type] of [
    [domain, 'NS'],
    [domain, 'A'],
    [`www.${domain}`, 'A'],
    [`www.${domain}`, 'CNAME'],
    [domain, 'AAAA'],
  ]) {
    try {
      const answers = await doh(name, type);
      const text = answers.length ? answers.map((a) => a.data).join(', ') : '（无记录）';
      line(`${type} ${name === domain ? '@' : 'www'}`, text);
    } catch (err) {
      line(`${type} ${name}`, `查询失败：${err.message}`);
    }
  }

  console.log('');
  for (const url of [`https://${domain}/`, `http://${domain}/`]) {
    try {
      const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(12000) });
      line(url, `HTTP ${res.status}${res.headers.get('location') ? ` → ${res.headers.get('location')}` : ''}`);
    } catch (err) {
      line(url, `不可用（${err.cause?.code || err.name}）`);
    }
  }

  try {
    const res = await fetch(`https://${domain}/`, { signal: AbortSignal.timeout(15000) });
    const html = await res.text();
    const icp = html.match(/([京沪粤浙苏川鲁豫冀津晋蒙辽吉黑闽皖赣鄂湘桂琼渝贵云藏陕甘青宁新]ICP备[\d-]+号(?:-\d+)?)/);
    line('页面备案号', icp ? icp[1] : '未检测到（检查 NEXT_PUBLIC_ICP_BEIAN 并重新构建）');
    line('站点标题', (html.match(/<title>([^<]*)<\/title>/) || [, '未检测到'])[1]);
  } catch (err) {
    line('页面抓取', `失败：${err.message}`);
  }
  console.log('');
})();

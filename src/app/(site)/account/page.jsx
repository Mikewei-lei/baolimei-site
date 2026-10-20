import AccountClient from '@/components/AccountClient';

export const metadata = {
  title: '账户中心',
  description: '管理葆历莓云端账户、个人资料、头像、密码、设备会话与账户注销。',
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <>
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">Account</span>
          <h1>账户中心</h1>
          <p className="lede">
            管理云端账户、个人资料、头像、密码与设备会话。所有修改都会写回 PostgreSQL。
          </p>
        </div>
      </section>
      <section className="container" style={{ padding: '36px 24px 90px' }}>
        <AccountClient />
      </section>
    </>
  );
}

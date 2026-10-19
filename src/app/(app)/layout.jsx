import Header from '@/components/Header';

export default function AppLayout({ children }) {
  return (
    <>
      <a className="skip-link" href="#main">跳到主要内容</a>
      <Header />
      <main id="main">{children}</main>
    </>
  );
}

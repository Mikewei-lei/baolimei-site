import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function SiteLayout({ children }) {
  return (
    <>
      <a className="skip-link" href="#main">跳到主要内容</a>
      <Header />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}

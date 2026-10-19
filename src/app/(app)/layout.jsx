import Header from '@/components/Header';

export default function AppLayout({ children }) {
  return (
    <>
      <Header />
      <main>{children}</main>
    </>
  );
}

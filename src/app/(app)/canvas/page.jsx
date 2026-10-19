import CanvasClient from '@/components/CanvasClient';

export const metadata = {
  title: '无限画布',
  description: '节点式 AI 影视创作画布：提示词、关键帧、镜头与配乐自由连接，像剪辑一样编排你的 AI 剧组。',
};

export default function CanvasPage() {
  return <CanvasClient />;
}

import { AtlasEditor } from "@/components/AtlasEditor";
import { loadDemoConfigSource } from "@/lib/demo";

export default async function Home() {
  const demo = await loadDemoConfigSource();
  return <AtlasEditor initialSource={demo} />;
}

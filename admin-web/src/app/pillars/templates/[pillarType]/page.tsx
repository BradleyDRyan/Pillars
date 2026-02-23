import { PillarTemplateManager } from "@/components/pillar-template-manager";

type Params = {
  pillarType?: string;
};

type Props = {
  params: Promise<Params>;
};

export const dynamic = "force-dynamic";

export default async function PillarTemplateDetailPage({ params }: Props) {
  const { pillarType } = await params;
  return <PillarTemplateManager selectedType={pillarType || null} detailsOnly />;
}

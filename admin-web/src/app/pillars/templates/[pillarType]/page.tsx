import { PillarTemplateManager } from "@/components/pillar-template-manager";

type Params = {
  pillarType: string;
};

type Props = {
  params: Params;
};

export const dynamic = "force-dynamic";

export default function PillarTemplateDetailPage({ params }: Props) {
  return <PillarTemplateManager selectedType={params.pillarType} detailsOnly />;
}

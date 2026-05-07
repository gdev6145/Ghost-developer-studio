import { WorkspacePage } from '@/components/WorkspacePage'

interface PageProps {
  params: { id: string }
}

export default function Page({ params }: PageProps) {
  return <WorkspacePage workspaceId={params.id} />
}

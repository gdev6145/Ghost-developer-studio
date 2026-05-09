import { WorkspacePage } from '@/components/WorkspacePage'

interface PageProps {
  params?: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const resolvedParams = params ? await params : { id: '' }
  return <WorkspacePage workspaceId={resolvedParams.id} />
}

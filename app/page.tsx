import { getProfile } from "@/app/actions"
import { ClientPage } from "@/components/client-page"

export default async function Home() {
  // This runs on the server, so we can call server actions here
  const profile = await getProfile()

  return (
    <main className="h-screen bg-neutral-950 text-neutral-100 font-mono">
      <ClientPage hasProfile={!!profile} />
    </main>
  )
}

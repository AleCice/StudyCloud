import { getChatSessions } from './actions'
import ChatInterface from '@/components/chat/ChatInterface'

export const metadata = {
  title: 'Chat AI - StudyCloud',
}

export default async function ChatPage() {
  const initialSessions = await getChatSessions()

  return <ChatInterface initialSessions={initialSessions} />
}

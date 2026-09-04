import { createAdminClient } from '@/lib/supabase/admin'

export interface AuditEventParams {
  userId: string
  action: string
  entityType: 'document' | 'course' | 'folder' | 'flashcard' | 'session' | 'settings' | 'user'
  entityId?: string | null
  details?: Record<string, any>
}

/**
 * Registra un evento di audit per tracciabilità e sicurezza
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('audit_log').insert({
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      details: params.details || {}
    })
  } catch (err) {
    console.warn("Avviso audit logging:", err)
  }
}

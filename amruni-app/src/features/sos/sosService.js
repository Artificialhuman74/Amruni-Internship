import { api } from '../../services/api/api'
import { queueMutation } from '../../services/offline'

/**
 * Emergency contacts and alert history.
 *
 * These used to live in Firestore — the only part of the product on a second
 * backend — behind credentials that were never set in production. Adding a
 * contact threw, and the list the SOS button depends on stayed empty. They are
 * on the main API now: one database, one auth path, one failure mode.
 *
 * Writes go through the outbox, so naming someone on a train works and syncs
 * when the signal returns. The one thing a woman must be able to do the moment
 * she thinks of it is say who should be called.
 */

export async function getContacts() {
  const { data } = await api.get('/me/sos/contacts');
  return data ?? [];
}

export async function addContact(contact) {
  const body = {
    name: contact.name,
    phone: contact.phone,
    relation: contact.relation ?? null,
  };
  return queueMutation({
    method: 'post',
    url: '/me/sos/contacts',
    body,
    // Stands in for the row until the real one arrives, so she sees the person
    // she just added rather than an empty list.
    optimistic: { id: `pending_${Date.now()}`, ...body, pending: true },
  });
}

export async function deleteContact(contactId) {
  return queueMutation({
    method: 'delete',
    url: `/me/sos/contacts/${contactId}`,
    optimistic: { id: contactId, deleted: true },
  });
}

export async function getAlerts() {
  const { data } = await api.get('/me/sos/alerts');
  return data ?? [];
}

export async function saveAlert(alert) {
  return queueMutation({
    method: 'post',
    url: '/me/sos/alerts',
    body: { message: alert.message, sentTo: alert.sentTo ?? [], isTest: Boolean(alert.isTest) },
    optimistic: { id: `pending_${Date.now()}`, ...alert, pending: true },
  });
}

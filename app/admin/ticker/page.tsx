'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, Save, X, Eye, EyeOff } from 'lucide-react';
import { LocalizedInput } from '@/components/admin/LocalizedInput';
import { parseLocalized } from '@/lib/i18n/localized';

interface TickerMessage {
  id: string;
  text: unknown; // Json: { sr, en }
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function TickerAdminPage() {
  const [messages, setMessages] = useState<TickerMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<{ sr: string; en: string }>({ sr: '', en: '' });
  const [newMessageText, setNewMessageText] = useState<{ sr: string; en: string }>({ sr: '', en: '' });
  const [showNewForm, setShowNewForm] = useState(false);

  // Fetch messages on load
  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const response = await fetch('/api/admin/ticker');
      const data = await response.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      setError('Greška pri učitavanju poruka');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMessage = async () => {
    const trimmed = { sr: newMessageText.sr.trim(), en: newMessageText.en.trim() };
    if (!trimmed.sr && !trimmed.en) return;

    setSaving(true);
    try {
      const response = await fetch('/api/admin/ticker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });

      if (response.ok) {
        setNewMessageText({ sr: '', en: '' });
        setShowNewForm(false);
        fetchMessages();
      } else {
        const data = await response.json();
        setError(data.error || 'Greška pri dodavanju poruke');
      }
    } catch (err) {
      setError('Greška pri dodavanju poruke');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateMessage = async (id: string, updates: { text?: { sr: string; en: string }; isActive?: boolean; order?: number }) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/ticker/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        setEditingId(null);
        fetchMessages();
      } else {
        const data = await response.json();
        setError(data.error || 'Greška pri ažuriranju poruke');
      }
    } catch (err) {
      setError('Greška pri ažuriranju poruke');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMessage = async (id: string) => {
    if (!confirm('Da li ste sigurni da želite da obrišete ovu poruku?')) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/ticker/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchMessages();
      } else {
        const data = await response.json();
        setError(data.error || 'Greška pri brisanju poruke');
      }
    } catch (err) {
      setError('Greška pri brisanju poruke');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    await handleUpdateMessage(id, { isActive: !currentActive });
  };

  const startEditing = (message: TickerMessage) => {
    setEditingId(message.id);
    setEditingText(parseLocalized(message.text));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingText({ sr: '', en: '' });
  };

  const saveEditing = async () => {
    const trimmed = { sr: editingText.sr.trim(), en: editingText.en.trim() };
    if (!editingId || (!trimmed.sr && !trimmed.en)) return;
    await handleUpdateMessage(editingId, { text: trimmed });
  };

  // Active messages for preview
  const activeMessages = messages.filter(m => m.isActive);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text">Trakica Poruke</h1>
          <p className="text-text-muted mt-1">
            Upravljajte porukama koje se prikazuju u ticker trakici na vrhu sajta.
          </p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg
                     hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nova poruka
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-error-light text-error px-4 py-3 rounded-lg mb-6 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Preview */}
      {activeMessages.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-text-muted uppercase tracking-wide mb-3">
            Pregled
          </h2>
          <div className="bg-primary text-white rounded-lg overflow-hidden">
            <div className="py-2.5 px-4 flex items-center gap-6 overflow-x-auto">
              {activeMessages.map((message, index) => {
                const t = parseLocalized(message.text);
                const display = t.sr || t.en || '';
                return (
                  <span key={message.id} className="flex items-center whitespace-nowrap">
                    {index > 0 && <span className="w-1.5 h-1.5 bg-white rounded-full mr-3" />}
                    {display}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* New message form */}
      {showNewForm && (
        <div className="bg-background-alt border border-border rounded-lg p-4 mb-6">
          <h3 className="font-medium text-text mb-3">Nova poruka</h3>
          <div className="flex flex-col gap-3">
            <LocalizedInput
              label="Tekst"
              name="ticker_text"
              value={newMessageText}
              onChange={setNewMessageText}
              placeholder={{ sr: 'Unesite tekst poruke...', en: 'Enter message text...' }}
              maxLength={200}
            />
            <div className="flex gap-3">
              <button
                onClick={handleAddMessage}
                disabled={saving || (!newMessageText.sr.trim() && !newMessageText.en.trim())}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg
                           hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                Sačuvaj
              </button>
              <button
                onClick={() => {
                  setShowNewForm(false);
                  setNewMessageText({ sr: '', en: '' });
                }}
                className="px-4 py-2 border border-border rounded-lg hover:bg-background-alt
                           transition-colors"
              >
                Otkaži
              </button>
            </div>
          </div>
          <p className="text-xs text-text-muted mt-2">
            max 200 karaktera po jeziku
          </p>
        </div>
      )}

      {/* Messages list */}
      <div className="space-y-2">
        {messages.length === 0 ? (
          <div className="text-center py-12 bg-background-alt rounded-lg">
            <p className="text-text-muted">Nema poruka. Dodajte prvu poruku.</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-center gap-3 p-4 bg-white border rounded-lg
                         ${!message.isActive ? 'opacity-60' : ''}`}
            >
              {/* Drag handle */}
              <div className="cursor-move text-text-light hover:text-text-muted">
                <GripVertical className="w-5 h-5" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {editingId === message.id ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex-1 min-w-0">
                      <LocalizedInput
                        label=""
                        name="edit_text"
                        value={editingText}
                        onChange={setEditingText}
                        placeholder={{ sr: 'Tekst...', en: 'Text...' }}
                        maxLength={200}
                        compact
                      />
                    </div>
                    <button
                      onClick={saveEditing}
                      disabled={saving || (!editingText.sr.trim() && !editingText.en.trim())}
                      className="p-1.5 text-success hover:bg-success-light rounded shrink-0"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="p-1.5 text-text-muted hover:bg-background-alt rounded shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <p
                    onClick={() => startEditing(message)}
                    className="cursor-text truncate hover:text-primary"
                  >
                    {parseLocalized(message.text).sr || parseLocalized(message.text).en || '(prazno)'}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {/* Toggle active */}
                <button
                  onClick={() => handleToggleActive(message.id, message.isActive)}
                  className={`p-2 rounded transition-colors ${
                    message.isActive
                      ? 'text-success hover:bg-success-light'
                      : 'text-text-muted hover:bg-background-alt'
                  }`}
                  title={message.isActive ? 'Aktivna' : 'Neaktivna'}
                >
                  {message.isActive ? (
                    <Eye className="w-5 h-5" />
                  ) : (
                    <EyeOff className="w-5 h-5" />
                  )}
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDeleteMessage(message.id)}
                  className="p-2 text-error hover:bg-error-light rounded transition-colors"
                  title="Obriši"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Help text */}
      <div className="mt-8 p-4 bg-background-alt rounded-lg">
        <h3 className="font-medium text-text mb-2">Saveti</h3>
        <ul className="text-sm text-text-muted space-y-1">
          <li>• Kliknite na tekst poruke da je izmenite</li>
          <li>• Koristite ikonu oka da sakrijete/prikažete poruku</li>
          <li>• Poruke se prikazuju u redosledu kojim su navedene</li>
          <li>• Maksimalna dužina poruke je 200 karaktera</li>
        </ul>
      </div>
    </div>
  );
}

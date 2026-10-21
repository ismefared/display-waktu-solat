import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertTriangle,
  Bell,
  Volume2,
  Eye,
  Sliders,
  Save,
} from 'lucide-react';
import { AnnouncementItem, TickerConfig } from '../types/domain';
import { AnnouncementService } from '../services/announcementService';

interface AnnouncementManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcements: AnnouncementItem[];
  tickerConfig: TickerConfig;
  onSaveAnnouncements: (
    items: AnnouncementItem[],
    config: TickerConfig
  ) => void;
}

export const AnnouncementManagerModal: React.FC<AnnouncementManagerModalProps> = ({
  isOpen,
  onClose,
  announcements,
  tickerConfig,
  onSaveAnnouncements,
}) => {
  const [items, setItems] = useState<AnnouncementItem[]>(announcements);
  const [config, setConfig] = useState<TickerConfig>(tickerConfig);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState<string>('');
  const [formMessage, setFormMessage] = useState<string>('');
  const [formPriority, setFormPriority] = useState<
    'NORMAL' | 'IMPORTANT' | 'URGENT'
  >('NORMAL');
  const [formEnabled, setFormEnabled] = useState<boolean>(true);
  const [formStartAt, setFormStartAt] = useState<string>('');
  const [formExpiresAt, setFormExpiresAt] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'items' | 'config' | 'preview'>(
    'items'
  );

  if (!isOpen) return null;

  const resetForm = () => {
    setEditingId(null);
    setFormTitle('');
    setFormMessage('');
    setFormPriority('NORMAL');
    setFormEnabled(true);
    setFormStartAt('');
    setFormExpiresAt('');
    setFormError(null);
  };

  const handleStartEdit = (item: AnnouncementItem) => {
    setEditingId(item.id);
    setFormTitle(item.title || '');
    setFormMessage(item.message);
    setFormPriority(item.priority);
    setFormEnabled(item.enabled);
    setFormStartAt(item.startAtIso ? item.startAtIso.slice(0, 16) : '');
    setFormExpiresAt(item.expiresAtIso ? item.expiresAtIso.slice(0, 16) : '');
    setFormError(null);
    setActiveTab('items');
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = AnnouncementService.validateInput({
      title: formTitle,
      message: formMessage,
      priority: formPriority,
      enabled: formEnabled,
      startAtIso: formStartAt ? new Date(formStartAt).toISOString() : undefined,
      expiresAtIso: formExpiresAt
        ? new Date(formExpiresAt).toISOString()
        : undefined,
    });

    if (!validation.valid || !validation.sanitized) {
      setFormError(validation.errorBM || 'Maklumat pengumuman tidak sah.');
      return;
    }

    const now = Date.now();
    let updatedList: AnnouncementItem[];

    if (editingId) {
      updatedList = items.map((it) =>
        it.id === editingId
          ? {
              ...it,
              ...validation.sanitized,
              updatedAtMs: now,
            }
          : it
      );
    } else {
      const newItem: AnnouncementItem = {
        id: `ann-${now}-${Math.floor(Math.random() * 1000)}`,
        title: validation.sanitized.title,
        message: validation.sanitized.message || '',
        priority: validation.sanitized.priority || 'NORMAL',
        enabled: validation.sanitized.enabled !== false,
        startAtIso: validation.sanitized.startAtIso,
        expiresAtIso: validation.sanitized.expiresAtIso,
        createdAtMs: now,
        updatedAtMs: now,
      };
      updatedList = [newItem, ...items];
    }

    setItems(updatedList);
    onSaveAnnouncements(updatedList, config);
    resetForm();
  };

  const handleDeleteItem = (id: string) => {
    const next = items.filter((it) => it.id !== id);
    setItems(next);
    onSaveAnnouncements(next, config);
    if (editingId === id) resetForm();
  };

  const handleToggleItemEnabled = (id: string) => {
    const next = items.map((it) =>
      it.id === id ? { ...it, enabled: !it.enabled, updatedAtMs: Date.now() } : it
    );
    setItems(next);
    onSaveAnnouncements(next, config);
  };

  const handleSaveConfig = (newConfig: TickerConfig) => {
    setConfig(newConfig);
    onSaveAnnouncements(items, newConfig);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-modal-title"
      data-testid="announcement-manager-modal"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div className="bg-[#0A1614] border border-amber-500/40 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-3 bg-[#081714]">
          <div className="flex items-center gap-2.5">
            <Volume2 className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h2
                id="announcement-modal-title"
                className="text-base sm:text-lg font-bold text-white"
              >
                Pengurusan Pengumuman &amp; Ticker TV
              </h2>
              <p className="text-xs text-slate-300">
                Urus maklumat siaran langsung yang dipaparkan pada skrin TV.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-white/10 bg-[#06100E] px-4 pt-2 gap-2 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'items'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Senarai Pengumuman ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'config'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Tetapan Ticker &amp; Kelajuan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'preview'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Pratonton Ticker TV
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* TAB 1: ITEMS & FORM */}
          {activeTab === 'items' && (
            <div className="space-y-4">
              {/* Form Card */}
              <form
                onSubmit={handleSaveItem}
                data-testid="announcement-form"
                className="bg-[#0D221D] border border-white/10 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-amber-400" />
                    <span>
                      {editingId ? 'Kemaskini Pengumuman' : 'Tambah Pengumuman Baru'}
                    </span>
                  </h3>
                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Batal Edit
                    </button>
                  )}
                </div>

                {formError && (
                  <div className="text-xs p-2.5 bg-rose-950/80 border border-rose-500/50 rounded-lg text-rose-200">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-slate-300">
                      Tajuk / Kategori (Pilihan, max 40 aksara)
                    </label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="Contoh: Kuliah Maghrib / Adab Solat"
                      maxLength={40}
                      className="w-full px-3 py-2 bg-[#060D0C] border border-white/20 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">
                      Keutamaan Paparan
                    </label>
                    <select
                      value={formPriority}
                      onChange={(e) =>
                        setFormPriority(
                          e.target.value as 'NORMAL' | 'IMPORTANT' | 'URGENT'
                        )
                      }
                      className="w-full px-3 py-2 bg-[#060D0C] border border-white/20 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="NORMAL">Biasa (Hijau)</option>
                      <option value="IMPORTANT">Perhatian (Kuning)</option>
                      <option value="URGENT">Penting / Segera (Merah)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-slate-300">
                      Mesej Pengumuman (Max 180 aksara)
                    </label>
                    <span
                      className={`font-mono-tabular ${
                        formMessage.length > 160
                          ? 'text-amber-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {formMessage.length}/180
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={formMessage}
                    onChange={(e) => setFormMessage(e.target.value)}
                    placeholder="Masukkan teks pengumuman yang akan dipaparkan pada ticker bawah TV..."
                    maxLength={180}
                    required
                    className="w-full px-3 py-2 bg-[#060D0C] border border-white/20 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-amber-400 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">
                      Mula Papar (Pilihan)
                    </label>
                    <input
                      type="datetime-local"
                      value={formStartAt}
                      onChange={(e) => setFormStartAt(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[#060D0C] border border-white/20 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">
                      Tamat Papar (Pilihan)
                    </label>
                    <input
                      type="datetime-local"
                      value={formExpiresAt}
                      onChange={(e) => setFormExpiresAt(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[#060D0C] border border-white/20 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formEnabled}
                      onChange={(e) => setFormEnabled(e.target.checked)}
                      className="rounded accent-emerald-500 w-4 h-4"
                    />
                    <span>Aktifkan pengumuman ini serta-merta</span>
                  </label>

                  <button
                    type="submit"
                    data-testid="btn-save-announcement"
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{editingId ? 'Simpan Kemaskini' : 'Tambah ke TV'}</span>
                  </button>
                </div>
              </form>

              {/* Items List */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300">
                  Senarai Pengumuman ({items.length})
                </div>

                {items.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs bg-[#060D0C] rounded-xl border border-white/5">
                    Tiada pengumuman berdaftar. Ticker TV akan memaparkan mesej
                    statik lalai.
                  </div>
                ) : (
                  items.map((it) => (
                    <div
                      key={it.id}
                      data-testid="announcement-item-row"
                      className={`p-3 rounded-xl border transition-colors flex items-start justify-between gap-3 ${
                        it.enabled
                          ? 'bg-[#081A15] border-white/10'
                          : 'bg-[#060D0C]/60 border-white/5 opacity-60'
                      }`}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          {it.priority === 'URGENT' ? (
                            <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px] uppercase">
                              Penting
                            </span>
                          ) : it.priority === 'IMPORTANT' ? (
                            <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10px] uppercase">
                              Perhatian
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-700 text-white font-bold text-[10px] uppercase">
                              Biasa
                            </span>
                          )}
                          {it.title && (
                            <span className="text-xs font-bold text-amber-300 truncate">
                              {it.title}
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-slate-100 leading-snug">
                          {it.message}
                        </p>
                        {(it.startAtIso || it.expiresAtIso) && (
                          <div className="text-[10px] text-slate-400 font-mono-tabular">
                            Jadual:{' '}
                            {it.startAtIso
                              ? new Date(it.startAtIso).toLocaleDateString()
                              : 'Kini'}{' '}
                            -{' '}
                            {it.expiresAtIso
                              ? new Date(it.expiresAtIso).toLocaleDateString()
                              : 'Kekal'}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleItemEnabled(it.id)}
                          title={it.enabled ? 'Nyahaktifkan' : 'Aktifkan'}
                          className={`p-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            it.enabled
                              ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                              : 'bg-white/5 text-slate-400 hover:text-white'
                          }`}
                        >
                          {it.enabled ? 'Aktif' : 'Mati'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(it)}
                          title="Edit"
                          className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(it.id)}
                          title="Padam"
                          className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TICKER CONFIG */}
          {activeTab === 'config' && (
            <div className="space-y-4">
              <div className="bg-[#0D221D] border border-white/10 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <span>Konfigurasi Ticker Bawah TV</span>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) =>
                        handleSaveConfig({ ...config, enabled: e.target.checked })
                      }
                      className="rounded accent-emerald-500 w-4 h-4"
                    />
                    <span>Papar Ticker pada TV</span>
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">
                    Kelajuan Skrol Ticker
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['SLOW', 'NORMAL', 'FAST'] as const).map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() =>
                          handleSaveConfig({ ...config, speed: spd })
                        }
                        className={`min-h-[44px] p-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                          config.speed === spd
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-[#060D0C] text-slate-300 border-white/10 hover:bg-white/5'
                        }`}
                      >
                        {spd === 'SLOW' && 'Perlahan (45s)'}
                        {spd === 'NORMAL' && 'Sederhana (30s)'}
                        {spd === 'FAST' && 'Pantas (18s)'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Had kelajuan dihadkan untuk memastikan mesej mudah dibaca
                    dari jarak 10 meter.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Mesej Statik Sandaran (Apabila tiada pengumuman aktif)
                  </label>
                  <textarea
                    rows={2}
                    value={config.staticFallbackText}
                    onChange={(e) =>
                      handleSaveConfig({
                        ...config,
                        staticFallbackText: e.target.value,
                      })
                    }
                    maxLength={160}
                    className="w-full px-3 py-2 bg-[#060D0C] border border-white/20 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LIVE PREVIEW */}
          {activeTab === 'preview' && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-emerald-400" />
                <span>Pratonton Paparan Ticker (Simulasi Skrin TV)</span>
              </div>
              <div className="bg-[#030B09] border border-amber-500/30 rounded-xl p-3 flex items-center gap-3 overflow-hidden shadow-inner">
                <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-[#081F17] rounded-lg border border-amber-500/20 text-xs font-black text-amber-300 uppercase">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>PENGUMUMAN</span>
                </div>
                <div className="flex-1 min-w-0 text-xs sm:text-sm text-slate-100 font-medium truncate">
                  {items.find((i) => i.enabled)?.message ||
                    config.staticFallbackText}
                </div>
              </div>
              <p className="text-[11px] text-slate-400 text-center">
                Ticker ini dipaparkan secara konsisten di bahagian bawah skrin
                siaran langsung TV tanpa menutupi kiraan waktu solat.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-white/10 flex items-center justify-between gap-3 bg-[#081714]">
          <div className="text-xs text-emerald-300 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>Diselaraskan ke TV secara masa nyata (P2P LAN)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 py-2 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

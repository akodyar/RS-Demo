import React, { useState } from 'react';
import { MessageSquare, Send, User, ShieldCheck, Wrench, Building } from 'lucide-react';
import { TenantConversationItem } from '../../types/tenant.js';
import { useI18n } from '../../i18n/I18nProvider';

interface TenantMessagesViewProps {
  conversations: TenantConversationItem[];
}

export const TenantMessagesView: React.FC<TenantMessagesViewProps> = ({ conversations }) => {
  const { t } = useI18n();

  const defaultConversations: TenantConversationItem[] = conversations;

  const [selectedConv, setSelectedConv] = useState<TenantConversationItem>(defaultConversations[0]);
  const [messagesList, setMessagesList] = useState<Array<{ id: string; sender: string; text: string; time: string; isMe: boolean }>>([]);
  const [inputText, setInputText] = useState('');

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setMessagesList(prev => [
      ...prev,
      {
        id: String(Date.now()),
        sender: 'Me',
        text: inputText.trim(),
        time: 'Just now',
        isMe: true,
      },
    ]);
    setInputText('');
  };

  return (
    <div id="tenant-messages-view" className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs grid grid-cols-1 md:grid-cols-3 min-h-[520px]">
      {/* Conversations List */}
      <div className="border-e border-slate-200/80 p-4 space-y-3 bg-slate-50/40">
        <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <span>{t('tenant.directChannels', 'Authorized Channels')}</span>
        </h3>

        <div className="space-y-1.5">
          {defaultConversations.map((conv) => (
            <button
              key={conv.id}
              id={`conv-item-${conv.id}`}
              type="button"
              onClick={() => setSelectedConv(conv)}
              className={`w-full text-start p-3 rounded-xl transition-all cursor-pointer flex items-start gap-3 ${
                selectedConv.id === conv.id
                  ? 'bg-blue-50/80 border border-blue-200'
                  : 'hover:bg-slate-100/70 border border-transparent'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                conv.avatarType === 'management'
                  ? 'bg-blue-100 text-blue-700'
                  : conv.avatarType === 'owner'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {conv.avatarType === 'management' ? (
                  <Building className="w-4 h-4" />
                ) : conv.avatarType === 'owner' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Wrench className="w-4 h-4" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 truncate">
                    {conv.participantName}
                  </h4>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {conv.timestamp}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {conv.lastMessage}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Conversation View */}
      <div className="md:col-span-2 flex flex-col justify-between p-4 bg-white">
        {/* Chat Header */}
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-extrabold text-slate-900">
              {selectedConv.participantName}
            </h4>
            <span className="text-[10px] font-bold text-blue-600 uppercase">
              {selectedConv.participantRole.replace('_', ' ')}
            </span>
          </div>
          <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
            <ShieldCheck className="w-3 h-3" />
            {t('tenant.confirmed', 'Verified')}
          </span>
        </div>

        {/* Message Bubble Feed */}
        <div className="flex-1 py-4 space-y-3 overflow-y-auto max-h-[360px]">
          {messagesList.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs sm:max-w-md px-4 py-2.5 rounded-2xl text-xs sm:text-sm ${
                  m.isMe
                    ? 'bg-blue-600 text-white rounded-br-xs'
                    : 'bg-slate-100 text-slate-800 rounded-bl-xs'
                }`}
              >
                <p>{m.text}</p>
                <span className={`text-[9px] mt-1 block ${m.isMe ? 'text-blue-200' : 'text-slate-400'}`} dir="ltr">
                  {m.time}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Message Input Box */}
        <form onSubmit={handleSendMessage} className="pt-3 border-t border-slate-100 flex items-center gap-2">
          <input
            id="tenant-message-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t('tenant.typeMessagePlaceholder', 'Type your message...')}
            className="flex-1 text-xs sm:text-sm px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <button
            id="tenant-send-message-btn"
            type="submit"
            className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
            title={t('tenant.send', 'Send')}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

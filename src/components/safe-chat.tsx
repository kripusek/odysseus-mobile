import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { ApiError, safeChat } from '@/lib/api';
import type { Pairing } from '@/lib/pairing';
import { usePairing } from '@/lib/pairing-context';

type Message = { role: 'user' | 'assistant'; content: string };

/** Remote conversations live only in this screen; no session endpoints or tools. */
export function SafeChatScreen({ pairing }: { pairing: Pairing }) {
  const { unpair } = usePairing();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function send() {
    const text = input.trim();
    if (!text || inFlight.current) return;
    const next: Message[] = [...messages, { role: 'user', content: text }];
    // Zachowujemy pełne pary; nie wysyłamy częściowo uciętej historii.
    while (next.length > 16 || next.slice(0, -1).some((m) => m.content.length > 8000) || next.reduce((n, m) => n + m.content.length, 0) > 32000) {
      if (next.length <= 1) break;
      next.splice(0, 2);
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await safeChat(pairing, next);
      setMessages([...next, { role: 'assistant', content: response }]);
      setInput('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send the message.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View><Text style={styles.title}>Odysseus</Text><Text style={styles.dim}>Text chat · local model</Text></View>
        <Pressable accessibilityRole="button" onPress={() => Alert.alert('Unpair this device?', 'You will need a new pairing code to reconnect.', [
          { text: 'Cancel', style: 'cancel' }, { text: 'Unpair', style: 'destructive', onPress: () => void unpair() },
        ])}><Text style={styles.action}>Unpair</Text></Pressable>
      </View>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList data={messages} keyExtractor={(_, i) => String(i)} contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.dim}>Messages stay in this chat until you leave the screen.</Text>}
          renderItem={({ item }) => <View style={[styles.bubble, item.role === 'user' ? styles.user : styles.assistant]}><Text style={styles.text}>{item.content}</Text></View>} />
        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <View style={styles.composer}>
          <TextInput testID="safe-chat-input" style={styles.input} value={input} onChangeText={setInput} editable={!busy} multiline maxLength={8000} placeholder="Write a message" placeholderTextColor={theme.color.textFaint} />
          <Pressable testID="safe-chat-send" accessibilityRole="button" disabled={busy || !input.trim()} onPress={() => void send()} style={styles.send}>
            {busy ? <ActivityIndicator color={theme.color.onAccent} /> : <Text style={styles.sendText}>Send</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.bg }, fill: { flex: 1 },
  header: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: theme.color.border },
  title: { color: theme.color.text, fontSize: 20, fontWeight: '700' }, dim: { color: theme.color.textDim }, action: { color: theme.color.accent },
  list: { padding: 16, gap: 12, flexGrow: 1 }, bubble: { padding: 12, borderRadius: 12, maxWidth: '90%' },
  user: { alignSelf: 'flex-end', backgroundColor: theme.color.userBubble }, assistant: { alignSelf: 'flex-start', backgroundColor: theme.color.assistantBubble }, text: { color: theme.color.text, fontSize: 16 },
  error: { color: theme.color.danger, paddingHorizontal: 16, paddingVertical: 6 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 8 }, input: { flex: 1, color: theme.color.text, backgroundColor: theme.color.surface, borderRadius: 12, padding: 12, maxHeight: 160 },
  send: { backgroundColor: theme.color.accent, padding: 12, borderRadius: 12, minWidth: 60, alignItems: 'center' }, sendText: { color: theme.color.onAccent, fontWeight: '700' },
});

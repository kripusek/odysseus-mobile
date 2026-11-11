import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeChatScreen } from '@/components/safe-chat';
import { safeChat, ApiError } from '@/lib/api';
import type { Pairing } from '@/lib/pairing';

jest.mock('@/lib/pairing-context', () => ({ usePairing: () => ({ unpair: jest.fn() }) }));
jest.mock('@/lib/api', () => ({
  safeChat: jest.fn(),
  ApiError: class ApiError extends Error { constructor(message: string) { super(message); } },
}));
const p: Pairing = { v: 2, host: 'ai.example.com', port: 443, tls: true, token: 'ody_abcdefgh' };
const chat = safeChat as jest.Mock;
beforeEach(() => chat.mockReset());

test('sends a text conversation and renders the answer', async () => {
  chat.mockResolvedValue('Answer');
  const screen = await render(<SafeChatScreen pairing={p} />);
  await fireEvent.changeText(screen.getByTestId('safe-chat-input'), 'Hello');
  await fireEvent.press(screen.getByTestId('safe-chat-send'));
  await waitFor(() => expect(screen.getByText('Answer')).toBeTruthy());
  expect(chat).toHaveBeenCalledWith(p, [{ role: 'user', content: 'Hello' }]);
});

test('shows failures and keeps the draft for retry', async () => {
  chat.mockRejectedValue(new ApiError('Server responded 503.', 'server', 503));
  const screen = await render(<SafeChatScreen pairing={p} />);
  await fireEvent.changeText(screen.getByTestId('safe-chat-input'), 'Hello');
  await fireEvent.press(screen.getByTestId('safe-chat-send'));
  await waitFor(() => expect(screen.getByText('Server responded 503.')).toBeTruthy());
  expect(screen.getByTestId('safe-chat-input').props.value).toBe('Hello');
});

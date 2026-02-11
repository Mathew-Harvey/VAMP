import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Header from './Header';

const mockGet = vi.fn();
const mockPatch = vi.fn();
const mockLogoutMutate = vi.fn();

vi.mock('@/api/client', () => ({
  default: {
    get: (...args: any[]) => mockGet(...args),
    patch: (...args: any[]) => mockPatch(...args),
  },
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    user: { firstName: 'Test', lastName: 'User', email: 'test@example.com' },
    organisation: { name: 'MarineStream Test' },
  }),
}));

vi.mock('@/stores/call.store', () => ({
  useCallStore: () => ({
    activeWorkOrderId: null,
    isInCall: false,
    isPanelOpen: false,
    togglePanel: vi.fn(),
    endCall: vi.fn(),
    startCall: vi.fn(),
    remoteCallActive: false,
    remoteCallCount: 0,
    remoteCallWorkOrderId: null,
    remoteCallWorkOrderTitle: null,
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useLogout: () => ({
    mutate: mockLogoutMutate,
  }),
}));

function renderHeader() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Header />
    </QueryClientProvider>,
  );
}

describe('Header notifications', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPatch.mockReset();

    mockGet.mockImplementation((url: string) => {
      if (url === '/notifications/count') {
        return Promise.resolve({ data: { data: { count: 2 } } });
      }
      if (url === '/notifications') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'n1',
                title: 'Work order assigned',
                message: 'You were added to WO-001',
                isRead: false,
                createdAt: new Date().toISOString(),
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    mockPatch.mockResolvedValue({ data: { success: true } });
  });

  it('opens notifications dialog from the bell and marks unread item as read', async () => {
    renderHeader();

    const bellButton = await screen.findByLabelText('Open notifications');
    await userEvent.click(bellButton);

    expect(await screen.findByText('Notifications')).toBeInTheDocument();
    expect(await screen.findByText('Work order assigned')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mark read' }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/notifications/n1/read');
    });
  });

  it('marks all unread notifications as read', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/notifications/count') {
        return Promise.resolve({ data: { data: { count: 2 } } });
      }
      if (url === '/notifications') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'n1',
                title: 'Work order assigned',
                message: 'You were added to WO-001',
                isRead: false,
                createdAt: new Date().toISOString(),
              },
              {
                id: 'n2',
                title: 'Form updated',
                message: 'A collaborator updated component notes',
                isRead: false,
                createdAt: new Date().toISOString(),
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderHeader();
    await userEvent.click(await screen.findByLabelText('Open notifications'));

    expect(await screen.findByText('Work order assigned')).toBeInTheDocument();
    expect(await screen.findByText('Form updated')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /mark all read/i }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/notifications/n1/read');
      expect(mockPatch).toHaveBeenCalledWith('/notifications/n2/read');
    });
  });
});


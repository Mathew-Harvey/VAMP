import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { useAuthStore } from '../stores/auth.store';

export function useLogin() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onSuccess: (response) => {
      const { accessToken, user, organisation } = response.data.data;
      setAuth({ accessToken, user, organisation });
      navigate('/dashboard');
    },
  });
}

export function useRegister() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: { email: string; password: string; firstName: string; lastName: string; phone?: string }) =>
      authApi.register(data),
    onSuccess: (response) => {
      const { accessToken, user, organisation } = response.data.data;
      setAuth({ accessToken, user, organisation });
      navigate('/dashboard');
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      authApi.resetPassword(token, password),
  });
}

export function useLogout() {
  const { logout } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      logout();
      navigate('/login');
    },
  });
}

export function useProfile() {
  const { isAuthenticated } = useAuthStore();
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.getProfile().then((r) => r.data.data),
    enabled: isAuthenticated,
  });
}

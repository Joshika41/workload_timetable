import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

export const Route = createFileRoute('/faculty/')({
  component: FacultyIndexRedirect,
});

function FacultyIndexRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: '/faculty/dashboard', replace: true });
  }, [navigate]);

  return null;
}

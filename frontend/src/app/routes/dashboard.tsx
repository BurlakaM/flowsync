import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useMe } from '@/features/auth';

export default function DashboardRoute() {
  const { data: user } = useMe();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">
        Welcome{user ? `, ${user.name}` : ''}
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Your workspace is almost ready</CardTitle>
          <CardDescription>
            Projects, tasks and comments are coming in the next stage of the
            migration.
          </CardDescription>
        </CardHeader>
        {user && (
          <CardContent className="text-sm text-muted-foreground">
            Signed in as {user.email} ({user.role.toLowerCase()}).
          </CardContent>
        )}
      </Card>
    </div>
  );
}

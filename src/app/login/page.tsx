import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">CCE / RVV</h1>
          <p className="mt-1 text-sm text-gray-500">Recherche juridique</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}

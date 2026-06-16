import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex bg-white dark:bg-black">
      {/* Left "” branding */}
      <div className="hidden lg:flex flex-1 bg-brand items-center justify-center">
        <div className="text-white text-center px-12">
          <div className="text-6xl font-bold mb-4">Deemona</div>
          <p className="text-xl text-blue-100">
            Connect. Share. Amplify.
          </p>
        </div>
      </div>
      {/* Right "” form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

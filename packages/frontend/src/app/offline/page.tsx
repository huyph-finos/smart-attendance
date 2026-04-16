import ReloadButton from './reload-button';

export const metadata = {
  title: 'Offline - Smart Attendance',
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
          <svg
            className="h-10 w-10 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 11-12.728 0M12 9v4m0 4h.01"
            />
          </svg>
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          Bạn đang ngoại tuyến
        </h1>
        <p className="mb-6 text-gray-600">
          Vui lòng kiểm tra kết nối mạng và thử lại.
          <br />
          Các thao tác chấm công sẽ được lưu và đồng bộ khi có mạng.
        </p>
        <ReloadButton />
      </div>
    </div>
  );
}

import React from 'react';

interface AlertProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  description?: string;  // Add description here as an optional property
}

const AlertDescription: React.FC<{ description: string }> = ({ description }) => {
  return <p className="text-sm">{description}</p>;
};

const Alert: React.FC<AlertProps> = ({ message, type, description }) => {
  let alertClass = '';

  switch (type) {
    case 'success':
      alertClass = 'bg-green-100 text-green-800';
      break;
    case 'error':
      alertClass = 'bg-red-100 text-red-800';
      break;
    case 'info':
      alertClass = 'bg-blue-100 text-blue-800';
      break;
    case 'warning':
      alertClass = 'bg-yellow-100 text-yellow-800';
      break;
    default:
      alertClass = 'bg-gray-100 text-gray-800';
      break;
  }

  return (
    <div className={`p-4 mb-4 rounded-lg ${alertClass}`} role="alert">
      <strong>{message}</strong>
      {description && <AlertDescription description={description} />}
    </div>
  );
};

export { Alert, AlertDescription };

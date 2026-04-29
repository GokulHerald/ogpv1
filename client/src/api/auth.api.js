import api from './axiosInstance.js';

export function startEmailRegistration(body) {
  return api.post('/auth/register/start', body);
}

export function verifyEmailRegistration(body) {
  return api.post('/auth/register/verify', body);
}

export function verifyOTP({ idToken }) {
  return api.post('/auth/verify-otp', { idToken });
}

export function completeRegistration(data) {
  return api.post('/auth/complete-registration', data);
}

export function login({ phoneNumber, email, password }) {
  return api.post('/auth/login', { phoneNumber, email, password });
}

export function getMe() {
  return api.get('/auth/me');
}

export function updateProfilePicture(formData) {
  return api.post('/auth/profile-picture', formData, {
    transformRequest: [
      (data, headers) => {
        delete headers['Content-Type'];
        return data;
      },
    ],
  });
}

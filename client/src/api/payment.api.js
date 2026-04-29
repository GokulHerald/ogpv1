import api from './axiosInstance.js';

export function initiateEsewaPayment(body) {
  return api.post('/payments/esewa/initiate', body);
}

export function initiateKhaltiPayment(body) {
  return api.post('/payments/khalti/initiate', body);
}


export const API_BASE_URL = 'http://localhost:5280/api';

export const ENDPOINTS = {
  // Auth
  LOGIN:       '/auth/login',
  VERIFY_2FA:  '/auth/verify-2fa',
  LOGOUT:      '/auth/logout',
  REFRESH:     '/auth/refresh',
  PROFILE:     '/auth/profile',

  // Staff / Users
  STAFF_LIST:  '/staff',
  STAFF_BY_ID: (id) => `/staff/${id}`,
  CREATE_USER: '/staff/create',
  UPDATE_USER: (id) => `/staff/${id}`,

  // Attendance
  ATTENDANCE:           '/attendance',
  CHECKIN:              '/attendance/checkin',
  CHECKOUT:             '/attendance/checkout',
  ATTENDANCE_REPORT:    '/attendance/report',
  ATTENDANCE_MONTHLY:   '/attendance/monthly',
  ATTENDANCE_MY_REPORT: '/attendance/my-report',
  ATTENDANCE_MY_MONTHLY:'/attendance/my-monthly',
  ATTENDANCE_FORCE:     '/attendance/force',
  HOLIDAYS:             '/attendance/holidays',
  HOLIDAY_BY_ID:        (id) => `/attendance/holidays/${id}`,

  // Leave
  LEAVE_LIST:  '/leave',
  LEAVE_APPLY: '/leave/apply',
  LEAVE_BY_ID: (id) => `/leave/${id}`,

  // Departments
  DEPARTMENTS:     '/departments',
  DEPARTMENT_BY_ID:(id) => `/departments/${id}`,

  // Location
  LOCATION_UPDATE:  '/location/update',
  LOCATION_HISTORY: '/location/history',
  ALL_STAFF_LOCS:   '/location/all-staff',
};

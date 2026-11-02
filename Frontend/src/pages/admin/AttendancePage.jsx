import { useState, useEffect } from 'react';
import { 
  Calendar, Clock, Download, Upload, CheckCircle, XCircle, 
  AlertCircle, Users, TrendingUp, FileDown, FileUp, ChevronLeft, ChevronRight,
  Search, Filter, MoreVertical, Edit2, Trash2, Eye
} from 'lucide-react';
import { api } from '../../utils/api';
import { formatDate } from '../../utils/formatters';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';

// Status configuration
const STATUS_CONFIG = {
  present: { label: 'Present', icon: CheckCircle, color: 'bg-green-50 text-green-700', badge: 'success' },
  absent: { label: 'Absent', icon: XCircle, color: 'bg-red-50 text-red-700', badge: 'error' },
  leave: { label: 'On Leave', icon: AlertCircle, color: 'bg-blue-50 text-blue-700', badge: 'info' },
  half_day: { label: 'Half Day', icon: Clock, color: 'bg-amber-50 text-amber-700', badge: 'warning' },
};

// Tab navigation
const TABS = [
  { id: 'calendar', label: 'Calendar View', icon: Calendar },
  { id: 'daily', label: 'Daily Marking', icon: CheckCircle },
  { id: 'reports', label: 'Reports', icon: TrendingUp },
  { id: 'import', label: 'Import CSV', icon: Upload },
];

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState('calendar');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarData, setCalendarData] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  // Daily marking state
  const [markingDate, setMarkingDate] = useState(new Date().toISOString().split('T')[0]);
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [bulkStatus, setBulkStatus] = useState('present');
  const [checkInTime, setCheckInTime] = useState('09:00');
  const [checkOutTime, setCheckOutTime] = useState('18:00');

  // Reports state
  const [reportDateFrom, setReportDateFrom] = useState(getFirstDayOfMonth());
  const [reportDateTo, setReportDateTo] = useState(getTodayDate());
  const [statistics, setStatistics] = useState(null);

  // Import state
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);

  // Fetch users on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch calendar data when month/user changes
  useEffect(() => {
    if (activeTab === 'calendar') {
      fetchCalendarData();
    }
  }, [currentMonth, selectedUser, activeTab]);

  // Helper functions
  function getFirstDayOfMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }

  function getTodayDate() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  async function fetchUsers() {
    try {
      // Try staff endpoint first (exists in api object)
      const response = await api.getStaff();
      if (response.success) {
        const data = response.data;
        // Ensure it's always an array
        setUsers(Array.isArray(data) ? data : []);
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error('Error fetching staff:', err);
      setUsers([]); // Set empty array on error
    }
  }

  async function fetchCalendarData() {
    setLoading(true);
    setError(null);
    try {
      const monthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
      const params = { month: monthStr };
      if (selectedUser) params.userId = selectedUser;

      const response = await api.getAttendanceCalendar(params);
      if (response.success) {
        // Ensure data is always an array
        const data = response.data;
        setCalendarData(Array.isArray(data) ? data : []);
      } else {
        setCalendarData([]);
      }
    } catch (err) {
      setError('Failed to fetch calendar data: ' + err.message);
      setCalendarData([]); // Set empty array on error
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function markAttendance(type = 'bulk') {
    if (selectedUsers.length === 0 && type === 'bulk') {
      alert('Please select at least one user');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        attendanceDate: markingDate,
        bulkStatus,
        checkInTime,
        checkOutTime,
        userIds: selectedUsers.length === users.length ? 'all' : selectedUsers,
      };

      const response = await api.markAttendance(payload);
      if (response.success) {
        alert('Attendance marked successfully');
        setSelectedUsers([]);
        fetchCalendarData();
      }
    } catch (err) {
      alert(err.message || 'Failed to mark attendance');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStatistics() {
    setLoading(true);
    try {
      const params = {
        startDate: reportDateFrom,
        endDate: reportDateTo,
        ...(selectedUser && { userId: selectedUser }),
      };

      const response = await api.getAttendanceStats(params);
      if (response.success) {
        setStatistics(response.data);
      }
    } catch (err) {
      alert('Failed to fetch statistics: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function exportToExcel() {
    try {
      const params = {
        startDate: reportDateFrom,
        endDate: reportDateTo,
        ...(selectedUser && { userId: selectedUser }),
      };

      const blob = await api.exportAttendance(params);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_${reportDateFrom}_${reportDateTo}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export data: ' + err.message);
      console.error(err);
    }
  }

  async function handleImport() {
    if (!importFile) {
      alert('Please select a CSV file');
      return;
    }

    setLoading(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);

      const response = await api.importAttendance(formData);
      if (response.success) {
        setImportResult(response.data);
        alert(`Import successful! ${response.data.imported} records imported.`);
        setImportFile(null);
        fetchCalendarData();
      }
    } catch (err) {
      alert(err.message || 'Import failed');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function downloadSampleCSV() {
    const sample = `userId,attendanceDate,status,checkInTime,checkOutTime,notes
uuid-example-1,2026-10-28,present,09:00,18:00,Regular day
uuid-example-2,2026-10-28,absent,,,Sick leave
uuid-example-3,2026-10-28,half_day,09:00,13:00,Morning only`;

    const blob = new Blob([sample], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'attendance_sample.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function changeMonth(direction) {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);
    setCurrentMonth(newMonth);
  }

  function toggleSelectAll() {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(u => u.id));
    }
  }

  function toggleUserSelection(userId) {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  }

  // Render functions for each tab
  function renderCalendarView() {
    const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    return (
      <div className="space-y-6">
        {/* Controls */}
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => changeMonth(-1)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  aria-label="Previous month"
                >
                  <ChevronLeft size={20} />
                </button>
                <h3 className="text-lg font-semibold min-w-[200px] text-center">{monthName}</h3>
                <button
                  onClick={() => changeMonth(1)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  aria-label="Next month"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={selectedUser || ''}
                  onChange={(e) => setSelectedUser(e.target.value || null)}
                  className="input w-[200px]"
                >
                  <option value="">All Users</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* Calendar Grid */}
        <Card>
          <div className="p-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-blue-600"></div>
                <p className="mt-3 text-sm text-slate-600">Loading calendar...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12 text-red-600">{error}</div>
            ) : (
              <div className="space-y-4">
                {/* Legend */}
                <div className="flex items-center gap-4 flex-wrap pb-4 border-b">
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded ${config.color.split(' ')[0]}`}></div>
                        <span className="text-xs text-slate-600">{config.label}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Simple list view of attendance records */}
                {calendarData.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    No attendance records for this month
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Array.isArray(calendarData) && calendarData.map((record, idx) => {
                      const config = STATUS_CONFIG[record.status] || STATUS_CONFIG.present;
                      const Icon = config.icon;
                      return (
                        <div key={idx} className={`p-3 rounded-lg border ${config.color}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Icon size={18} />
                              <div>
                                <p className="font-medium">{record.user_name || 'Unknown User'}</p>
                                <p className="text-xs opacity-75">{formatDate(record.attendance_date)}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold">{config.label}</p>
                              {record.check_in_time && (
                                <p className="text-xs opacity-75">
                                  {record.check_in_time} - {record.check_out_time || '---'}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  function renderDailyMarking() {
    return (
      <div className="space-y-6">
        {/* Controls */}
        <Card>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input
                  type="date"
                  value={markingDate}
                  onChange={(e) => setMarkingDate(e.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  className="input w-full"
                >
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Check-In Time</label>
                <input
                  type="time"
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Check-Out Time</label>
                <input
                  type="time"
                  value={checkOutTime}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                  className="input w-full"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <button
                onClick={toggleSelectAll}
                className="btn-secondary"
              >
                {selectedUsers.length === users.length ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={() => markAttendance('bulk')}
                disabled={loading || selectedUsers.length === 0}
                className="btn-primary"
              >
                <CheckCircle size={16} />
                Mark Attendance ({selectedUsers.length} selected)
              </button>
            </div>
          </div>
        </Card>

        {/* User List */}
        <Card>
          <div className="p-4">
            <h3 className="text-sm font-semibold mb-4">Select Staff Members</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {users.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No staff members found
                </div>
              ) : (
                Array.isArray(users) && users.map(user => (
                  <label
                    key={user.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.email} • {user.role}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  function renderReports() {
    return (
      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">From Date</label>
                <input
                  type="date"
                  value={reportDateFrom}
                  onChange={(e) => setReportDateFrom(e.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">To Date</label>
                <input
                  type="date"
                  value={reportDateTo}
                  onChange={(e) => setReportDateTo(e.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">User (Optional)</label>
                <select
                  value={selectedUser || ''}
                  onChange={(e) => setSelectedUser(e.target.value || null)}
                  className="input w-full"
                >
                  <option value="">All Users</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button onClick={fetchStatistics} className="btn-primary flex-1">
                  <TrendingUp size={16} />
                  Generate Report
                </button>
                <button onClick={exportToExcel} className="btn-secondary">
                  <Download size={16} />
                  Export Excel
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Total Days</p>
                    <p className="text-2xl font-bold">{statistics.total_days || 0}</p>
                  </div>
                  <Calendar className="text-blue-600" size={32} />
                </div>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Present</p>
                    <p className="text-2xl font-bold text-green-600">{statistics.present_days || 0}</p>
                  </div>
                  <CheckCircle className="text-green-600" size={32} />
                </div>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Absent</p>
                    <p className="text-2xl font-bold text-red-600">{statistics.absent_days || 0}</p>
                  </div>
                  <XCircle className="text-red-600" size={32} />
                </div>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">On Leave</p>
                    <p className="text-2xl font-bold text-blue-600">{statistics.leave_days || 0}</p>
                  </div>
                  <AlertCircle className="text-blue-600" size={32} />
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    );
  }

  function renderImport() {
    return (
      <div className="space-y-6">
        <Card>
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Import Attendance from CSV</h3>
              <p className="text-sm text-slate-600">
                Upload a CSV file with attendance records. The file should have the following columns:
                userId, attendanceDate, status, checkInTime, checkOutTime, notes
              </p>
            </div>

            {/* Sample Download */}
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <p className="font-medium text-blue-900">Download Sample CSV</p>
                <p className="text-xs text-blue-700">Use this template to format your import file</p>
              </div>
              <button onClick={downloadSampleCSV} className="btn-secondary">
                <FileDown size={16} />
                Download Sample
              </button>
            </div>

            {/* File Upload */}
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setImportFile(e.target.files[0])}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <FileUp size={48} className="mx-auto text-slate-400 mb-3" />
                <p className="text-sm font-medium">
                  {importFile ? importFile.name : 'Click to select CSV file or drag and drop'}
                </p>
                <p className="text-xs text-slate-500 mt-1">Maximum file size: 5MB</p>
              </label>
            </div>

            {/* Import Button */}
            <button
              onClick={handleImport}
              disabled={!importFile || loading}
              className="btn-primary w-full"
            >
              <Upload size={16} />
              {loading ? 'Importing...' : 'Import Attendance'}
            </button>

            {/* Import Results */}
            {importResult && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="font-medium text-green-900">Import Successful</p>
                <div className="mt-2 text-sm text-green-700 space-y-1">
                  <p>✓ Imported: {importResult.imported} records</p>
                  <p>✓ Updated: {importResult.updated} records</p>
                  {importResult.skipped > 0 && (
                    <p className="text-amber-700">⚠ Skipped: {importResult.skipped} records (duplicates or errors)</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Staff Attendance</h1>
          <p className="page-subtitle">Manage and track staff attendance records</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary">
            <Users size={16} />
            Manage Staff
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-6">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 font-medium'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'calendar' && renderCalendarView()}
      {activeTab === 'daily' && renderDailyMarking()}
      {activeTab === 'reports' && renderReports()}
      {activeTab === 'import' && renderImport()}
    </div>
  );
}

const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { sendEmail } = require('../utils/mailer');

// GET /api/leave
router.get('/', auth, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const [rows] = isAdmin
      ? await db.query('SELECT l.*, s.name as staff_name, s.email as staff_email FROM leave_requests l JOIN staff s ON l.staff_id = s.id ORDER BY l.created_at DESC')
      : await db.query('SELECT * FROM leave_requests WHERE staff_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching leaves:', error);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
});

// POST /api/leave/apply
router.post('/apply', auth, async (req, res) => {
  try {
    const { from_date, to_date, reason, type, notify_email } = req.body;
    
    // Insert leave request
    const [result] = await db.query(
      'INSERT INTO leave_requests (staff_id, from_date, to_date, reason, type, status) VALUES (?, ?, ?, ?, ?, "pending")',
      [req.user.id, from_date, to_date, reason, type]
    );

    // Fetch user details for the email notification
    const [[staff]] = await db.query('SELECT name, email, username FROM staff WHERE id = ?', [req.user.id]);
    
    const staffName = staff ? (staff.name || staff.username) : 'Staff Member';
    const staffEmail = staff ? (staff.email || 'N/A') : 'N/A';

    // If notify_email is true or default true, send email to admin
    if (notify_email !== false) {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@abstechnologies.org.in';
      const subject = `New Leave Request from ${staffName}`;
      
      const html = `
        <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #EF4444 0%, #B91C1C 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center; color: white;">
            <h2 style="margin: 0; font-size: 24px; font-weight: 700;">Leave Request Submitted</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">ABS Staff Management Portal</p>
          </div>
          <div style="padding: 24px; color: #1e293b;">
            <p style="font-size: 16px; line-height: 1.5; margin-top: 0;">Hi Admin,</p>
            <p style="font-size: 14px; line-height: 1.5; color: #475569;">A new leave request has been submitted by <strong>${staffName}</strong>. Here are the details:</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid #EF4444; padding: 16px; border-radius: 4px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 120px;">Staff Name:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${staffName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Staff Email:</td>
                  <td style="padding: 6px 0; color: #0f172a;">${staffEmail}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Leave Type:</td>
                  <td style="padding: 6px 0; color: #0f172a;"><span style="background-color: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">${type || 'General'}</span></td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Duration:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${from_date} to ${to_date}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600; vertical-align: top;">Reason:</td>
                  <td style="padding: 6px 0; color: #334155; line-height: 1.4;">${reason || 'No reason provided.'}</td>
                </tr>
              </table>
            </div>
            
            <p style="font-size: 14px; line-height: 1.5; color: #475569;">Please log in to the admin panel to approve or reject this request.</p>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="https://staff.abstechnologies.org.in" style="background-color: #EF4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">Open Admin Panel</a>
            </div>
          </div>
          <div style="border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8;">
            &copy; 2026 ABS Technologies. All rights reserved.
          </div>
        </div>
      `;

      const text = `New Leave Request from ${staffName}.\nType: ${type}\nDates: ${from_date} to ${to_date}\nReason: ${reason}\n\nPlease review on the Admin Panel.`;
      
      await sendEmail({ to: adminEmail, subject, html, text }).catch(e => {
        console.error('Failed to send email to admin:', e.message);
      });
    }

    res.json({ id: result.insertId, status: 'pending' });
  } catch (error) {
    console.error('Error applying for leave:', error);
    res.status(500).json({ error: 'Failed to apply for leave' });
  }
});

// PUT /api/leave/:id  (admin approve/reject)
router.put('/:id', auth, async (req, res) => {
  try {
    const { status } = req.body;
    
    // Fetch original leave and staff info BEFORE updating
    const [[leave]] = await db.query(
      'SELECT l.*, s.name as staff_name, s.email as staff_email, s.username FROM leave_requests l JOIN staff s ON l.staff_id = s.id WHERE l.id = ?',
      [req.params.id]
    );

    if (!leave) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    // Update status
    await db.query('UPDATE leave_requests SET status = ? WHERE id = ?', [status, req.params.id]);

    // Send email notification to staff if they have an email
    if (leave.staff_email) {
      const staffName = leave.staff_name || leave.username;
      const statusTitle = status.toUpperCase();
      const statusColor = status === 'approved' ? '#059669' : '#DC2626';
      const statusBg = status === 'approved' ? '#D1FAE5' : '#FEE2E2';
      
      const subject = `Leave Request ${statusTitle} - ABS Staff Portal`;
      
      const html = `
        <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, ${statusColor} 0%, #1f2937 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center; color: white;">
            <h2 style="margin: 0; font-size: 24px; font-weight: 700;">Leave Request ${statusTitle}</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">ABS Staff Management Portal</p>
          </div>
          <div style="padding: 24px; color: #1e293b;">
            <p style="font-size: 16px; line-height: 1.5; margin-top: 0;">Hi ${staffName},</p>
            <p style="font-size: 14px; line-height: 1.5; color: #475569;">Your leave request has been reviewed by the administrator.</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid ${statusColor}; padding: 16px; border-radius: 4px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 120px;">Status:</td>
                  <td style="padding: 6px 0;"><span style="background-color: ${statusBg}; color: ${statusColor}; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; text-transform: uppercase;">${status}</span></td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Leave Type:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${leave.type || 'General'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Duration:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${leave.from_date} to ${leave.to_date}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600; vertical-align: top;">Reason:</td>
                  <td style="padding: 6px 0; color: #334155; line-height: 1.4;">${leave.reason || 'No reason provided.'}</td>
                </tr>
              </table>
            </div>
            
            <p style="font-size: 14px; line-height: 1.5; color: #475569;">Log in to the staff portal to view your leave balance and status updates.</p>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="https://staff.abstechnologies.org.in" style="background-color: #1e293b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">Open Staff Portal</a>
            </div>
          </div>
          <div style="border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8;">
            &copy; 2026 ABS Technologies. All rights reserved.
          </div>
        </div>
      `;

      const text = `Your leave request for ${leave.from_date} to ${leave.to_date} has been ${statusTitle}.\nLog in to the portal to view details.`;
      
      await sendEmail({ to: leave.staff_email, subject, html, text }).catch(e => {
        console.error('Failed to send email to staff:', e.message);
      });
    }

    res.json({ message: 'Updated successfully' });
  } catch (error) {
    console.error('Error updating leave status:', error);
    res.status(500).json({ error: 'Failed to update leave request' });
  }
});

module.exports = router;

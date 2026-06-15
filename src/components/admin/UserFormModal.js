import React, { useState, useRef, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, Pressable, Image,
  ScrollView, StyleSheet, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors } from '@constants/colors';
import api from '@services/api';
import CameraModal from '@components/common/CameraModal';

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, keyboardType, secureTextEntry, multiline }) {
  return (
    <View style={f.wrap}>
      <Text style={f.label}>{label}</Text>
      <TextInput
        style={[f.input, multiline && { height: 72, textAlignVertical: 'top' }]}
        placeholder={placeholder || ''}
        placeholderTextColor="#9CA3AF"
        value={value || ''}
        onChangeText={onChange}
        keyboardType={keyboardType || 'default'}
        secureTextEntry={!!secureTextEntry}
        multiline={!!multiline}
        autoCapitalize="none"
      />
    </View>
  );
}

function DateField({ label, value, onChange }) {
  if (Platform.OS === 'web') {
    return (
      <View style={f.wrap}>
        <Text style={f.label}>{label}</Text>
        <input
          type="date"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={{
            height: 36, border: '1px solid #E5E7EB', borderRadius: 8,
            paddingLeft: 10, paddingRight: 10,
            fontSize: 13, color: value ? Colors.text : '#9CA3AF',
            backgroundColor: '#fff', width: '100%', outline: 'none',
            boxSizing: 'border-box', cursor: 'pointer', fontFamily: 'inherit',
          }}
        />
      </View>
    );
  }
  return (
    <Field label={label} value={value} onChange={onChange} placeholder="YYYY-MM-DD" />
  );
}

function Row({ children }) {
  return <View style={f.row}>{children}</View>;
}

function SectionTitle({ title }) {
  return <Text style={f.sectionTitle}>{title}</Text>;
}

function SelectField({ label, value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  if (Platform.OS === 'web') {
    return (
      <View style={f.wrap}>
        <Text style={f.label}>{label}</Text>
        <select
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={{
            height: 36, border: '1px solid #E5E7EB', borderRadius: 8,
            paddingLeft: 10, paddingRight: 10,
            fontSize: 13, color: value ? Colors.text : '#9CA3AF',
            backgroundColor: '#fff', width: '100%', outline: 'none',
            appearance: 'auto', cursor: 'pointer',
          }}
        >
          <option value="" disabled>Select...</option>
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </View>
    );
  }

  return (
    <View style={[f.wrap, open && { zIndex: 100 }]}>
      <Text style={f.label}>{label}</Text>
      <TouchableOpacity style={f.select} onPress={() => setOpen(o => !o)} activeOpacity={0.7}>
        <Text style={[f.selectText, !selected && { color: '#9CA3AF' }]}>
          {selected?.label || 'Select...'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#6B7280" />
      </TouchableOpacity>
      {open && (
        <View style={f.dropdown}>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
            {options.map(o => (
              <TouchableOpacity
                key={o.value}
                style={[f.dropdownItem, o.value === value && f.dropdownItemActive]}
                onPress={() => { onChange(o.value); setOpen(false); }}
              >
                <Text style={[f.dropdownText, o.value === value && { color: Colors.brandRed, fontWeight: '700' }]}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function ProfilePicField({ value, onChange }) {
  const uploadRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  if (Platform.OS !== 'web') return null;

  const readAsDataUrl = (file, cb) => {
    const reader = new FileReader();
    reader.onload = ev => cb(ev.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <View style={{ alignItems: 'center', marginBottom: 12 }}>
      <TouchableOpacity onPress={() => setMenuOpen(true)} activeOpacity={0.8}>
        <View style={f.avatarWrap}>
          {value
            ? <Image source={{ uri: value }} style={f.avatarImg} />
            : <Feather name="user" size={40} color="#9CA3AF" />}
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setMenuOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
        <Text style={{ fontSize: 11, color: '#6B7280' }}>Profile Photo</Text>
        <Feather name="edit-2" size={11} color="#6B7280" />
      </TouchableOpacity>

      <Modal visible={menuOpen} transparent animationType="fade">
        <TouchableOpacity style={f.popupOverlay} activeOpacity={1} onPress={() => setMenuOpen(false)}>
          <View style={f.popupBox}>
            <Text style={f.popupTitle}>Profile Photo</Text>
            <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 16 }}>
              <TouchableOpacity style={f.popupTile} onPress={() => uploadRef.current?.click()}>
                <View style={[f.popupTileIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Feather name="upload-cloud" size={26} color="#3B82F6" />
                </View>
                <Text style={f.popupTileTitle}>Upload</Text>
                <Text style={f.popupTileSub}>JPG or PNG</Text>
              </TouchableOpacity>
              <TouchableOpacity style={f.popupTile} onPress={() => { setMenuOpen(false); setCameraOpen(true); }}>
                <View style={[f.popupTileIcon, { backgroundColor: '#F0FDF4' }]}>
                  <Feather name="camera" size={26} color="#22C55E" />
                </View>
                <Text style={f.popupTileTitle}>Camera</Text>
                <Text style={f.popupTileSub}>Take photo</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={f.popupCloseBtn} onPress={() => setMenuOpen(false)}>
              <Text style={f.popupCloseTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
        <input ref={uploadRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const file = e.target.files?.[0]; if (file) readAsDataUrl(file, onChange); setMenuOpen(false); e.target.value=''; }} />
      </Modal>

      <CameraModal
        visible={cameraOpen}
        onCapture={file => readAsDataUrl(file, onChange)}
        onClose={() => setCameraOpen(false)}
      />
    </View>
  );
}

function DocUploadField({ label, value, onChange, inline }) {
  const uploadRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  if (Platform.OS !== 'web') return null;

  const files = Array.isArray(value) ? value : (value ? [value] : []);
  const hasFiles = files.length > 0;

  const handleUploadChange = (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    const merged = [...files, ...selected].slice(0, 2);
    onChange(merged);
    e.target.value = '';
    setMenuOpen(false);
  };

  const handleCameraCapture = (file) => {
    const merged = [...files, file].slice(0, 2);
    onChange(merged);
    setMenuOpen(false);
  };

  const removeFile = (idx) => {
    const updated = files.filter((_, i) => i !== idx);
    onChange(updated.length ? updated : null);
  };

  const popup = menuOpen ? (
    <>
      {/* fixed backdrop */}
      <Pressable
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 9998, justifyContent: 'center', alignItems: 'center' }}
        onPress={() => setMenuOpen(false)}
      >
        <Pressable
          style={[f.popupBox, { zIndex: 9999 }]}
          onPress={e => e.stopPropagation?.()}
        >
          <Text style={f.popupTitle}>{label || 'Attach Document'}</Text>
          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 16 }}>
            <TouchableOpacity style={f.popupTile} onPress={() => uploadRef.current?.click()}>
              <View style={[f.popupTileIcon, { backgroundColor: '#EFF6FF' }]}>
                <Feather name="upload-cloud" size={26} color="#3B82F6" />
              </View>
              <Text style={f.popupTileTitle}>Upload</Text>
              <Text style={f.popupTileSub}>PDF, JPG · max 2</Text>
            </TouchableOpacity>
            <TouchableOpacity style={f.popupTile} onPress={() => { setMenuOpen(false); setCameraOpen(true); }}>
              <View style={[f.popupTileIcon, { backgroundColor: '#F0FDF4' }]}>
                <Feather name="camera" size={26} color="#22C55E" />
              </View>
              <Text style={f.popupTileTitle}>Camera</Text>
              <Text style={f.popupTileSub}>Capture photo</Text>
            </TouchableOpacity>
          </View>

          {hasFiles && (
            <>
              <View style={f.popupDivider} />
              <Text style={f.popupFileTitle}>Attached ({files.length}/2)</Text>
              {files.map((file, i) => (
                <View key={i} style={f.popupFile}>
                  <Ionicons name="document-text-outline" size={15} color={Colors.brandRed} />
                  <Text style={f.popupFileName} numberOfLines={1}>{file?.name || `File ${i + 1}`}</Text>
                  <TouchableOpacity onPress={() => removeFile(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          <TouchableOpacity style={f.popupCloseBtn} onPress={() => setMenuOpen(false)}>
            <Text style={f.popupCloseTxt}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
      <input ref={uploadRef} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple style={{ display: 'none' }} onChange={handleUploadChange} />
    </>
  ) : null;

  const camera = <CameraModal visible={cameraOpen} onCapture={handleCameraCapture} onClose={() => setCameraOpen(false)} />;

  if (inline) {
    return (
      <View>
        <TouchableOpacity
          style={[f.docInlineBtn, hasFiles && { borderColor: Colors.brandRed, backgroundColor: '#FEF2F2' }]}
          onPress={() => setMenuOpen(true)}
          activeOpacity={0.7}
        >
          <Feather name={hasFiles ? 'file-text' : 'paperclip'} size={15} color={hasFiles ? Colors.brandRed : '#6B7280'} />
          {hasFiles && <Text style={{ fontSize: 9, color: Colors.brandRed, fontWeight: '700' }}>{files.length}</Text>}
        </TouchableOpacity>
        {popup}
        {camera}
      </View>
    );
  }

  return (
    <View style={f.docWrap}>
      <TouchableOpacity style={f.docBtn} onPress={() => setMenuOpen(true)} activeOpacity={0.7}>
        <Feather name={hasFiles ? 'file-text' : 'upload-cloud'} size={14} color={hasFiles ? Colors.brandRed : '#6B7280'} />
        <Text style={[f.docText, hasFiles && { color: Colors.brandRed }]} numberOfLines={1}>
          {hasFiles ? files.map(fi => fi?.name).join(', ') : `Upload ${label}`}
        </Text>
        {hasFiles && (
          <TouchableOpacity onPress={() => onChange(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={14} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
      {popup}
      {camera}
    </View>
  );
}

// ── Tab definitions ───────────────────────────────────────────────────────────

const TABS = [
  { key: 'basic',      label: 'Basic Info',  icon: 'person-outline' },
  { key: 'personal',   label: 'Personal',    icon: 'heart-outline' },
  { key: 'family',     label: 'Family',      icon: 'people-outline' },
  { key: 'identity',   label: 'Identity',    icon: 'shield-outline' },
  { key: 'employment', label: 'Employment',  icon: 'briefcase-outline' },
  { key: 'bank',       label: 'Bank',        icon: 'card-outline' },
  { key: 'salary',     label: 'Salary',      icon: 'wallet-outline' },
];

// ── Tab content ───────────────────────────────────────────────────────────────

function BasicTab({ data, set, isAdding, shiftsList = [], departmentsList = [] }) {
  const defaultOptions = [
    { value: 'Day Shift',     label: 'Day Shift (09:00 AM - 05:00 PM)' },
    { value: 'Evening Shift', label: 'Evening Shift (05:00 PM - 01:00 AM)' },
    { value: 'Night Shift',   label: 'Night Shift (01:00 AM - 09:00 AM)' },
    { value: 'day',           label: 'Day Shift' },
    { value: 'evening',       label: 'Evening Shift' },
    { value: 'night',         label: 'Night Shift' },
  ];

  const shiftOptions = shiftsList.length > 0
    ? shiftsList.map(sh => ({ value: sh.name, label: `${sh.name} (${sh.start_time} - ${sh.end_time})` }))
    : defaultOptions;

  return (
    <>
      <ProfilePicField value={data.profile_photo} onChange={v => set('profile_photo', v)} />
      <SectionTitle title="Employee Information" />
      <Row>
        <Field label="First Name *"  value={data.first_name}  onChange={v => set('first_name', v)}  placeholder="e.g. John" />
        <Field label="Middle Name"   value={data.middle_name} onChange={v => set('middle_name', v)} placeholder="e.g. Kumar" />
        <Field label="Last Name *"   value={data.last_name}   onChange={v => set('last_name', v)}   placeholder="e.g. Doe" />
      </Row>
      <Row>
        <Field label="Employee ID"   value={data.employee_id} onChange={v => set('employee_id', v)} placeholder="e.g. EMP001" />
        <Field label="Username *"    value={data.username}    onChange={v => set('username', v)}    placeholder="e.g. johndoe" />
        {isAdding && <Field label="Password *" value={data.password} onChange={v => set('password', v)} placeholder="Min 6 chars" secureTextEntry />}
      </Row>
      <Row>
        <Field label="Work Email"    value={data.email}         onChange={v => set('email', v)}         placeholder="work@company.com" keyboardType="email-address" />
        <Field label="Work Location" value={data.work_location} onChange={v => set('work_location', v)} placeholder="e.g. Jaipur HQ" />
      </Row>

      <SectionTitle title="Role & Status" />
      <Row>
        <SelectField
          label="Department"
          value={data.department}
          onChange={v => set('department', v)}
          options={
            departmentsList.length > 0
              ? departmentsList.map(d => ({ value: d.name, label: d.name }))
              : [
                  { value: 'Engineering', label: 'Engineering' },
                  { value: 'Sales',       label: 'Sales' },
                  { value: 'HR',          label: 'HR' },
                  { value: 'Finance',     label: 'Finance' },
                  { value: 'Operations',  label: 'Operations' },
                  { value: 'Marketing',   label: 'Marketing' },
                  { value: 'Management',  label: 'Management' },
                  { value: 'Other',       label: 'Other' },
                ]
          }
        />
        <Field label="Designation" value={data.designation} onChange={v => set('designation', v)} placeholder="e.g. Software Engineer" />
      </Row>
      <Row>
        <SelectField
          label="Employment Type"
          value={data.employment_type}
          onChange={v => set('employment_type', v)}
          options={[
            { value: 'Permanent', label: 'Permanent' },
            { value: 'Contract',  label: 'Contract' },
            { value: 'Intern',    label: 'Intern' },
            { value: 'Part-time', label: 'Part-time' },
          ]}
        />
        <DateField label="Date of Joining" value={data.date_of_joining} onChange={v => set('date_of_joining', v)} />
      </Row>
      <Row>
        <SelectField
          label="Account Role"
          value={data.role}
          onChange={v => set('role', v)}
          options={[{ value: 'user', label: 'User' }, { value: 'admin', label: 'Admin' }]}
        />
        <SelectField
          label="Employee Status"
          value={data.status}
          onChange={v => set('status', v)}
          options={[{ value: 'active', label: 'Active' }, { value: 'resign', label: 'Resign' }]}
        />
      </Row>
      <Row>
        <SelectField
          label="Shift *"
          value={data.shift}
          onChange={v => set('shift', v)}
          options={shiftOptions}
        />
        <Field label="Company Phone" value={data.company_phone} onChange={v => set('company_phone', v)} placeholder="Office number" keyboardType="phone-pad" />
      </Row>

      <SectionTitle title="Check-In Permission" />
      <Row>
        <SelectField
          label="Allowed Check-In Location"
          value={data.permissions?.checkin_outside ? 'outside' : 'inside'}
          onChange={v => set('permissions', { ...data.permissions, checkin_outside: v === 'outside' })}
          options={[
            { value: 'inside', label: 'Inside Only (Strict 50m Geofence)' },
            { value: 'outside', label: 'Outside Allowed (Anywhere)' }
          ]}
        />
        <SelectField
          label="Check-In Policy"
          value={data.checkin_policy || 'always'}
          onChange={v => set('checkin_policy', v)}
          options={[
            { value: 'always',      label: 'Always Allowed' },
            { value: 'never',       label: 'Never Allowed' },
            { value: 'shift_based', label: 'As Per Shift' },
          ]}
        />
      </Row>

      <SectionTitle title="Task Permissions" />
      <Row>
        <SelectField
          label="Can Create Own Tasks"
          value={data.permissions?.create_task ? 'yes' : 'no'}
          onChange={v => set('permissions', { ...data.permissions, create_task: v === 'yes' })}
          options={[
            { value: 'no',  label: 'No (Admin assigns only)' },
            { value: 'yes', label: 'Yes (Can create own tasks)' },
          ]}
        />
      </Row>
    </>
  );
}

function AddBtn({ onPress, label }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: -4 }}>
      <Ionicons name="add-circle-outline" size={16} color="#3B82F6" />
      <Text style={{ color: '#3B82F6', marginLeft: 4, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </TouchableOpacity>
  );
}

function RemoveBtn({ onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ alignSelf: 'center', marginTop: 12, padding: 8, marginLeft: -8 }}>
      <Ionicons name="trash-outline" size={20} color="#DC2626" />
    </TouchableOpacity>
  );
}

function PersonalTab({ data, set, updateArray, addArrayItem, removeArrayItem }) {
  return (
    <>
      <SectionTitle title="Personal Details" />
      <Row>
        <DateField label="Date of Birth" value={data.date_of_birth} onChange={v => set('date_of_birth', v)} />
        <SelectField
          label="Gender"
          value={data.gender}
          onChange={v => set('gender', v)}
          options={[
            { value: 'Male',   label: 'Male' },
            { value: 'Female', label: 'Female' },
            { value: 'Other',  label: 'Other' },
          ]}
        />
      </Row>
      <Row>
        <SelectField
          label="Marital Status"
          value={data.marital_status}
          onChange={v => set('marital_status', v)}
          options={[
            { value: 'Single',   label: 'Single' },
            { value: 'Married',  label: 'Married' },
            { value: 'Divorced', label: 'Divorced' },
            { value: 'Widowed',  label: 'Widowed' },
          ]}
        />
        <SelectField
          label="Blood Group"
          value={data.blood_group}
          onChange={v => set('blood_group', v)}
          options={['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => ({ value: g, label: g }))}
        />
      </Row>

      <SectionTitle title="Mobile Numbers" />
      <Row style={{ flexWrap: 'wrap' }}>
        {(data.phones || ['']).map((phone, i) => (
          <View key={`phone-${i}`} style={{ flexDirection: 'row', flex: 1, minWidth: 250 }}>
            <Field label={`Mobile Number ${i + 1}`} value={phone} onChange={v => updateArray('phones', i, null, v)} placeholder="e.g. 9876543210" keyboardType="phone-pad" />
            {data.phones?.length > 1 && <RemoveBtn onPress={() => removeArrayItem('phones', i)} />}
          </View>
        ))}
      </Row>
      <AddBtn onPress={() => addArrayItem('phones', '')} label="Add another Mobile Number" />

      <Row>
        <Field label="Nationality" value={data.nationality} onChange={v => set('nationality', v)} placeholder="e.g. Indian" />
      </Row>

      <SectionTitle title="Personal Emails" />
      <Row style={{ flexWrap: 'wrap' }}>
        {(data.personal_emails || ['']).map((email, i) => (
          <View key={`email-${i}`} style={{ flexDirection: 'row', flex: 1, minWidth: 250 }}>
            <Field label={`Personal Email ${i + 1}`} value={email} onChange={v => updateArray('personal_emails', i, null, v)} placeholder="personal@email.com" keyboardType="email-address" />
            {data.personal_emails?.length > 1 && <RemoveBtn onPress={() => removeArrayItem('personal_emails', i)} />}
          </View>
        ))}
      </Row>
      <AddBtn onPress={() => addArrayItem('personal_emails', '')} label="Add another Personal Email" />

      <SectionTitle title="Address" />
      <Field label="Current Address"   value={data.current_address}   onChange={v => set('current_address', v)}   placeholder="House, Street, City, State, PIN" multiline />
      <Field label="Permanent Address" value={data.permanent_address} onChange={v => set('permanent_address', v)} placeholder="Same as current or different" multiline />

      <SectionTitle title="Emergency Contacts" />
      {(data.emergency_contacts || []).map((contact, i) => (
        <View key={`emc-${i}`} style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Contact {i + 1}</Text>
          <Row>
            <Field label="Contact Name" value={contact.name} onChange={v => updateArray('emergency_contacts', i, 'name', v)} placeholder="Full name" />
            <Field label="Relationship" value={contact.rel} onChange={v => updateArray('emergency_contacts', i, 'rel', v)} placeholder="e.g. Spouse, Parent" />
          </Row>
          <Row>
            <Field label="Contact Phone" value={contact.phone} onChange={v => updateArray('emergency_contacts', i, 'phone', v)} placeholder="Mobile number" keyboardType="phone-pad" />
          </Row>
          {data.emergency_contacts?.length > 1 && (
            <TouchableOpacity onPress={() => removeArrayItem('emergency_contacts', i)} style={{ alignSelf: 'flex-end', marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="trash-outline" size={14} color="#DC2626" />
              <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '600', marginLeft: 4 }}>Remove Contact</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      <AddBtn onPress={() => addArrayItem('emergency_contacts', { name: '', rel: '', phone: '' })} label="Add another Emergency Contact" />
    </>
  );
}

function FamilyTab({ data, set }) {
  return (
    <>
      <SectionTitle title="Family Details" />
      <Row>
        <Field label="Father's Name"   value={data.father_name}  onChange={v => set('father_name', v)}  placeholder="Full name" />
        <Field label="Mother's Name"   value={data.mother_name}  onChange={v => set('mother_name', v)}  placeholder="Full name" />
      </Row>
      <Row>
        <Field label="Spouse's Name"   value={data.spouse_name}  onChange={v => set('spouse_name', v)}  placeholder="Full name (if married)" />
        <Field label="Family Mobile"   value={data.family_mobile} onChange={v => set('family_mobile', v)} placeholder="Contact number" keyboardType="phone-pad" />
      </Row>
    </>
  );
}

function FieldWithDoc({ label, value, onChange, placeholder, keyboardType, docValue, docLabel, onDocChange }) {
  return (
    <View style={[f.wrap, { zIndex: 1 }]}>
      <Text style={f.label}>{label}</Text>
      <View style={f.fieldDocRow}>
        <TextInput
          style={[f.input, { flex: 1 }]}
          placeholder={placeholder || ''}
          placeholderTextColor="#9CA3AF"
          value={value || ''}
          onChangeText={onChange}
          keyboardType={keyboardType || 'default'}
          autoCapitalize="none"
        />
        <DocUploadField label={docLabel} value={docValue} onChange={onDocChange} inline />
      </View>
    </View>
  );
}

function IdentityTab({ data, set }) {
  return (
    <>
      <SectionTitle title="Identity & Compliance" />
      <Row>
        <FieldWithDoc label="PAN Number" value={data.pan_number} onChange={v => set('pan_number', v)} placeholder="e.g. ABCDE1234F" docLabel="PAN" docValue={data.doc_pan} onDocChange={v => set('doc_pan', v)} />
        <FieldWithDoc label="Aadhaar Number" value={data.aadhaar_number} onChange={v => set('aadhaar_number', v)} placeholder="12-digit number" keyboardType="numeric" docLabel="Aadhaar" docValue={data.doc_aadhaar} onDocChange={v => set('doc_aadhaar', v)} />
      </Row>
      <Row>
        <FieldWithDoc label="Passport Number" value={data.passport_number} onChange={v => set('passport_number', v)} placeholder="If applicable" docLabel="Passport" docValue={data.doc_passport} onDocChange={v => set('doc_passport', v)} />
        <FieldWithDoc label="UAN Number" value={data.uan_number} onChange={v => set('uan_number', v)} placeholder="Universal Account No." keyboardType="numeric" docLabel="UAN" docValue={data.doc_uan} onDocChange={v => set('doc_uan', v)} />
      </Row>
      <Row>
        <Field label="PF Number"   value={data.pf_number}   onChange={v => set('pf_number', v)}   placeholder="Provident Fund No." />
        <Field label="ESIC Number" value={data.esic_number} onChange={v => set('esic_number', v)} placeholder="ESIC Number" />
      </Row>

      <SectionTitle title="Educational Details" />
      <Row>
        <FieldWithDoc label="Highest Qualification" value={data.highest_qualification} onChange={v => set('highest_qualification', v)} placeholder="e.g. B.Tech, MBA" docLabel="Certificate" docValue={data.doc_qualification} onDocChange={v => set('doc_qualification', v)} />
        <Field label="Specialization" value={data.specialization} onChange={v => set('specialization', v)} placeholder="e.g. Computer Science" />
      </Row>
    </>
  );
}

function EmploymentTab({ data, set, updateArray, addArrayItem, removeArrayItem }) {
  return (
    <>
      <SectionTitle title="Previous Employment" />
      {(data.previous_employments || []).map((emp, i) => (
        <View key={`emp-${i}`} style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Employment {i + 1}</Text>
          <Row>
            <Field label="Previous Company" value={emp.company} onChange={v => updateArray('previous_employments', i, 'company', v)} placeholder="Company name" />
            <Field label="Previous Designation" value={emp.designation} onChange={v => updateArray('previous_employments', i, 'designation', v)} placeholder="Role/Title" />
          </Row>
          <Row>
            <Field label="Total Experience" value={emp.experience} onChange={v => updateArray('previous_employments', i, 'experience', v)} placeholder="e.g. 3 years 6 months" />
            <Field label="Last Drawn Salary" value={emp.salary} onChange={v => updateArray('previous_employments', i, 'salary', v)} placeholder="e.g. 45000" keyboardType="numeric" />
          </Row>
          {data.previous_employments?.length > 1 && (
            <TouchableOpacity onPress={() => removeArrayItem('previous_employments', i)} style={{ alignSelf: 'flex-end', marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="trash-outline" size={14} color="#DC2626" />
              <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '600', marginLeft: 4 }}>Remove Employment</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      <AddBtn onPress={() => addArrayItem('previous_employments', { company: '', designation: '', experience: '', salary: '' })} label="Add another Employment" />
    </>
  );
}

function BankTab({ data, set, updateArray, addArrayItem, removeArrayItem }) {
  return (
    <>
      <SectionTitle title="Bank Details" />
      {(data.bank_details || []).map((bank, i) => (
        <View key={`bank-${i}`} style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Bank Account {i + 1}</Text>
          <Row>
            <Field label="Bank Name" value={bank.bank_name} onChange={v => updateArray('bank_details', i, 'bank_name', v)} placeholder="e.g. SBI, HDFC" />
            <Field label="Account Holder" value={bank.account_holder} onChange={v => updateArray('bank_details', i, 'account_holder', v)} placeholder="As per bank records" />
          </Row>
          <Row>
            <Field label="Account Number" value={bank.account_number} onChange={v => updateArray('bank_details', i, 'account_number', v)} placeholder="Bank account number" keyboardType="numeric" />
            <Field label="IFSC Code" value={bank.ifsc_code} onChange={v => updateArray('bank_details', i, 'ifsc_code', v)} placeholder="e.g. SBIN0001234" />
          </Row>
          <Row>
            <Field label="Branch Name" value={bank.branch_name} onChange={v => updateArray('bank_details', i, 'branch_name', v)} placeholder="e.g. Jaipur Main Branch" />
            {data.bank_details?.length > 1 && <RemoveBtn onPress={() => removeArrayItem('bank_details', i)} />}
          </Row>
        </View>
      ))}
      <AddBtn onPress={() => addArrayItem('bank_details', { bank_name: '', account_holder: '', account_number: '', ifsc_code: '', branch_name: '' })} label="Add another Bank Account" />
    </>
  );
}

export const PAY_HEAD_DEFAULTS = {
  'Basic Salary': {
    pay_head_type: 'Earnings for Employees',
    calculation_type: 'On Attendance',
    basis_of_calculation: 'As per Calendar Period',
    statutory_pay_type: ''
  },
  'HRA': {
    pay_head_type: 'Earnings for Employees',
    calculation_type: 'On Attendance',
    basis_of_calculation: 'As per Calendar Period',
    statutory_pay_type: ''
  },
  'PF': {
    pay_head_type: "Employees' Statutory Deductions",
    calculation_type: 'As Computed Value',
    basis_of_calculation: 'User Defined',
    statutory_pay_type: 'PF Account (A/c No. 1)'
  },
  'ESI': {
    pay_head_type: "Employees' Statutory Deductions",
    calculation_type: 'As Computed Value',
    basis_of_calculation: 'User Defined',
    statutory_pay_type: 'Employee State Insurance'
  },
  'Income Tax': {
    pay_head_type: "Employees' Statutory Deductions",
    calculation_type: 'As Computed Value',
    basis_of_calculation: 'User Defined',
    statutory_pay_type: 'Income Tax'
  },
  'Professional Tax': {
    pay_head_type: "Employees' Statutory Deductions",
    calculation_type: 'As Computed Value',
    basis_of_calculation: 'User Defined',
    statutory_pay_type: 'Professional Tax'
  },
  'Custom': {
    pay_head_type: 'Earnings for Employees',
    calculation_type: 'Flat Rate',
    basis_of_calculation: 'User Defined',
    statutory_pay_type: ''
  }
};

const tableStyles = {
  headerCell: {
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  headerText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cell: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: '#E8EDF2',
    justifyContent: 'center',
  }
};

function SalaryTab({ data, updateSalaryGroup, updateSalaryItem, addSalaryGroup, removeSalaryGroup, addSalaryItem, removeSalaryItem }) {
  return (
    <>
      <SectionTitle title="Salary Details (Tally Prime Grid)" />

      <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ marginBottom: 16 }}>
        <View style={{ width: 1020, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden' }}>
          
          {/* Table Header Row */}
          <View style={{ flexDirection: 'row', backgroundColor: '#F8FAFC', borderBottomWidth: 1.5, borderBottomColor: '#CBD5E1', minHeight: 40 }}>
            <View style={[tableStyles.headerCell, { width: 130 }]}>
              <Text style={tableStyles.headerText}>Effective From</Text>
            </View>
            <View style={[tableStyles.headerCell, { width: 180 }]}>
              <Text style={tableStyles.headerText}>Pay Head</Text>
            </View>
            <View style={[tableStyles.headerCell, { width: 110 }]}>
              <Text style={tableStyles.headerText}>Rate</Text>
            </View>
            <View style={[tableStyles.headerCell, { width: 80 }]}>
              <Text style={tableStyles.headerText}>Per</Text>
            </View>
            <View style={[tableStyles.headerCell, { width: 180 }]}>
              <Text style={tableStyles.headerText}>Pay Head Type</Text>
            </View>
            <View style={[tableStyles.headerCell, { width: 130 }]}>
              <Text style={tableStyles.headerText}>Calculation Type</Text>
            </View>
            <View style={[tableStyles.headerCell, { width: 130 }]}>
              <Text style={tableStyles.headerText}>Computed On</Text>
            </View>
            <View style={[tableStyles.headerCell, { width: 80, borderRightWidth: 0 }]}>
              <Text style={tableStyles.headerText}>Actions</Text>
            </View>
          </View>

          {/* Table Rows */}
          {(data.salary_details || []).map((group, gIdx) => {
            const items = group.items || [];
            return (
              <View key={`group-block-${gIdx}`} style={{ borderBottomWidth: gIdx < data.salary_details.length - 1 ? 2.5 : 0, borderBottomColor: '#CBD5E1' }}>
                {items.map((item, iIdx) => {
                  const defaults = PAY_HEAD_DEFAULTS[item.pay_head] || PAY_HEAD_DEFAULTS['Custom'];
                  const isFirstRow = iIdx === 0;

                  // Earning vs Deduction badge logic
                  const isEarning = defaults.pay_head_type.includes('Earnings');
                  const badgeBg = isEarning ? '#ECFDF5' : '#FEF2F2';
                  const badgeText = isEarning ? '#047857' : '#B91C1C';
                  const badgeBorder = isEarning ? '#D1FAE5' : '#FEE2E2';

                  return (
                    <View key={`item-row-${gIdx}-${iIdx}`} style={{ flexDirection: 'row', borderBottomWidth: iIdx < items.length - 1 ? 1 : 0, borderBottomColor: '#F1F5F9', minHeight: 48, backgroundColor: isFirstRow ? '#FCFDFE' : '#fff', alignItems: 'center' }}>
                      
                      {/* 1. Effective From */}
                      <View style={[tableStyles.cell, { width: 130 }]}>
                        {isFirstRow ? (
                          Platform.OS === 'web' ? (
                            <input
                              type="date"
                              value={group.effective_from || ''}
                              onChange={e => updateSalaryGroup(gIdx, 'effective_from', e.target.value)}
                              style={{
                                height: 32, border: '1px solid #E2E8F0', borderRadius: 6,
                                fontSize: 11, paddingLeft: 8, paddingRight: 8,
                                backgroundColor: '#fff', width: '100%', outline: 'none',
                                boxSizing: 'border-box', color: '#1E293B', fontWeight: '600'
                              }}
                            />
                          ) : (
                            <TextInput
                              style={{ height: 32, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, fontSize: 11, paddingHorizontal: 8, backgroundColor: '#fff', color: '#1E293B', fontWeight: '600' }}
                              value={group.effective_from}
                              onChangeText={v => updateSalaryGroup(gIdx, 'effective_from', v)}
                              placeholder="YYYY-MM-DD"
                            />
                          )
                        ) : (
                          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 16, color: '#94A3B8', fontWeight: 'bold' }}>〃</Text>
                          </View>
                        )}
                      </View>

                      {/* 2. Pay Head Dropdown */}
                      <View style={[tableStyles.cell, { width: 180 }]}>
                        {Platform.OS === 'web' ? (
                          <select
                            value={item.pay_head || ''}
                            onChange={e => updateSalaryItem(gIdx, iIdx, 'pay_head', e.target.value)}
                            style={{
                              height: 32, border: '1px solid #E2E8F0', borderRadius: 6,
                              fontSize: 11, paddingLeft: 8, paddingRight: 8,
                              backgroundColor: '#fff', width: '100%', outline: 'none',
                              boxSizing: 'border-box', color: '#1E293B', fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="Basic Salary">Basic Salary</option>
                            <option value="HRA">HRA</option>
                            <option value="PF">PF</option>
                            <option value="ESI">ESI</option>
                            <option value="Income Tax">Income Tax</option>
                            <option value="Professional Tax">Professional Tax</option>
                            <option value="Custom">Custom Pay Head</option>
                          </select>
                        ) : (
                          <TextInput
                            style={{ height: 32, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, fontSize: 11, paddingHorizontal: 8, backgroundColor: '#fff', fontWeight: '600', color: '#1E293B' }}
                            value={item.pay_head}
                            onChangeText={v => updateSalaryItem(gIdx, iIdx, 'pay_head', v)}
                          />
                        )}
                        {item.pay_head === 'Custom' && (
                          <TextInput
                            style={{ height: 28, borderWidth: 1, borderColor: '#FDE047', borderRadius: 6, fontSize: 10, paddingHorizontal: 8, backgroundColor: '#FEFCE8', color: '#854D0E', marginTop: 5, fontWeight: '500' }}
                            value={item.custom_pay_head}
                            onChangeText={v => updateSalaryItem(gIdx, iIdx, 'custom_pay_head', v)}
                            placeholder="Allowance Name..."
                          />
                        )}
                      </View>

                      {/* 3. Rate Input */}
                      <View style={[tableStyles.cell, { width: 110 }]}>
                        <TextInput
                          style={{ height: 32, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, fontSize: 12, paddingHorizontal: 8, backgroundColor: '#fff', textAlign: 'right', fontWeight: '700', color: '#1E293B' }}
                          value={String(item.rate)}
                          onChangeText={v => updateSalaryItem(gIdx, iIdx, 'rate', v)}
                          placeholder="0.00"
                          keyboardType="numeric"
                        />
                      </View>

                      {/* 4. Per Unit Badge */}
                      <View style={[tableStyles.cell, { width: 80, alignItems: 'center' }]}>
                        <View style={{ backgroundColor: '#F1F5F9', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                          <Text style={{ fontSize: 10, color: '#475569', fontWeight: '700' }}>Months</Text>
                        </View>
                      </View>

                      {/* 5. Resolved Pay Head Type Badge */}
                      <View style={[tableStyles.cell, { width: 180, alignItems: 'flex-start' }]}>
                        <View style={{ backgroundColor: badgeBg, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: badgeBorder, maxWidth: '95%' }}>
                          <Text style={{ fontSize: 10, color: badgeText, fontWeight: '700' }} numberOfLines={1}>
                            {defaults.pay_head_type}
                          </Text>
                        </View>
                      </View>

                      {/* 6. Resolved Calculation Type Badge */}
                      <View style={[tableStyles.cell, { width: 130, alignItems: 'flex-start' }]}>
                        <View style={{ backgroundColor: '#F8FAFC', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', maxWidth: '95%' }}>
                          <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '600' }} numberOfLines={1}>
                            {defaults.calculation_type}
                          </Text>
                        </View>
                      </View>

                      {/* 7. Resolved Basis of Calculation Badge */}
                      <View style={[tableStyles.cell, { width: 130, alignItems: 'flex-start' }]}>
                        {defaults.basis_of_calculation === 'As per Calendar Period' ? (
                          <View style={{ backgroundColor: '#EEF2F6', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', maxWidth: '95%' }}>
                            <Text style={{ fontSize: 10, color: '#475569', fontWeight: '600' }} numberOfLines={1}>
                              On Attendance
                            </Text>
                          </View>
                        ) : (
                          <Text style={{ fontSize: 10, color: '#94A3B8', fontStyle: 'italic', paddingLeft: 6 }}>-</Text>
                        )}
                      </View>

                      {/* 8. Action Triggers */}
                      <View style={[tableStyles.cell, { width: 80, borderRightWidth: 0, flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center' }]}>
                        {isFirstRow && items.length === 1 ? (
                          data.salary_details.length > 1 ? (
                            <TouchableOpacity onPress={() => removeSalaryGroup(gIdx)} style={{ padding: 4, borderRadius: 4, backgroundColor: '#FEF2F2' }}>
                              <Ionicons name="trash-outline" size={15} color="#DC2626" />
                            </TouchableOpacity>
                          ) : (
                            <View style={{ width: 16 }} />
                          )
                        ) : (
                          <TouchableOpacity onPress={() => removeSalaryItem(gIdx, iIdx)} style={{ padding: 2 }}>
                            <Ionicons name="close-circle-outline" size={17} color="#DC2626" />
                          </TouchableOpacity>
                        )}
                        
                        {isFirstRow && (
                          <TouchableOpacity onPress={() => addSalaryItem(gIdx)} style={{ padding: 2 }}>
                            <Ionicons name="add-circle-outline" size={17} color="#16A34A" />
                          </TouchableOpacity>
                        )}
                      </View>

                    </View>
                  );
                })}
              </View>
            );
          })}

        </View>
      </ScrollView>

      <TouchableOpacity 
        onPress={addSalaryGroup} 
        style={{ 
          flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, 
          backgroundColor: '#FFF5F5', paddingVertical: 8, paddingHorizontal: 14, 
          borderRadius: 8, borderWidth: 1, borderColor: Colors.brandRed || '#FCA5A5', 
          alignSelf: 'flex-start', marginBottom: 16
        }}
      >
        <Ionicons name="calendar-outline" size={14} color={Colors.brandRed || '#DC2626'} />
        <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.brandRed || '#DC2626' }}>Add New Period Version (Effective Date)</Text>
      </TouchableOpacity>
    </>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function UserFormModal({ visible, isAdding, initialData, onSave, onClose }) {
  const [activeTab, setActiveTab] = useState(0);
  const [data, setData] = useState(initialData || EMPTY_USER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [shiftsList, setShiftsList] = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]);

  const normalizeData = (d) => {
    let groupedSalary = [];
    if (Array.isArray(d.salary_details)) {
      if (d.salary_details.length > 0 && d.salary_details[0].items === undefined) {
        // Flat array format -> convert to grouped format by effective_from date
        const groups = {};
        d.salary_details.forEach(item => {
          const date = item.effective_from || d.date_of_joining || new Date().toISOString().split('T')[0];
          if (!groups[date]) {
            groups[date] = [];
          }
          groups[date].push({
            pay_head: item.pay_head || 'Basic Salary',
            custom_pay_head: item.custom_pay_head || '',
            rate: String(item.rate || '')
          });
        });
        groupedSalary = Object.keys(groups).map(date => ({
          effective_from: date,
          items: groups[date]
        }));
      } else {
        // Already grouped format or empty
        groupedSalary = d.salary_details.map(g => ({
          effective_from: g.effective_from || d.date_of_joining || new Date().toISOString().split('T')[0],
          items: Array.isArray(g.items) ? g.items.map(item => ({
            pay_head: item.pay_head || 'Basic Salary',
            custom_pay_head: item.custom_pay_head || '',
            rate: String(item.rate || '')
          })) : []
        }));
      }
    }

    if (groupedSalary.length === 0) {
      groupedSalary = [{
        effective_from: d.date_of_joining || new Date().toISOString().split('T')[0],
        items: [
          { pay_head: 'Basic Salary', custom_pay_head: '', rate: '' },
          { pay_head: 'HRA', custom_pay_head: '', rate: '' }
        ]
      }];
    }

    return {
      ...d,
      shift: d?.shift || 'day',
      phones: Array.isArray(d.phones) ? d.phones : (d.phone ? [d.phone] : ['']),
      personal_emails: Array.isArray(d.personal_emails) ? d.personal_emails : (d.personal_email ? [d.personal_email] : ['']),
      emergency_contacts: Array.isArray(d.emergency_contacts) && d.emergency_contacts.length > 0 ? d.emergency_contacts : [{ name: d.emergency_contact_name || '', rel: d.emergency_contact_rel || '', phone: d.emergency_contact_phone || '' }],
      previous_employments: Array.isArray(d.previous_employments) && d.previous_employments.length > 0 ? d.previous_employments : [{ company: d.prev_company || '', designation: d.prev_designation || '', experience: d.total_experience || '', salary: d.last_drawn_salary || '' }],
      bank_details: Array.isArray(d.bank_details) && d.bank_details.length > 0 ? d.bank_details : [{ bank_name: d.bank_name || '', account_holder: d.account_holder || '', account_number: d.account_number || '', ifsc_code: d.ifsc_code || '', branch_name: d.branch_name || '' }],
      salary_details: groupedSalary,
      permissions: d?.permissions ? (typeof d.permissions === 'string' ? JSON.parse(d.permissions) : d.permissions) : { checkin_outside: false },
      checkin_policy: d.checkin_policy || 'always',
    };
  };

  React.useEffect(() => {
    if (visible) {
      setData(normalizeData(initialData || EMPTY_USER));
      setActiveTab(0);
      setError('');
      // Fetch dynamic shifts
      api.get('/shifts').then(res => setShiftsList(res || [])).catch(() => {});
      api.get('/departments').then(res => setDepartmentsList(res || [])).catch(() => {});
    }
  }, [visible, initialData]);

  const set = (key, value) => setData(prev => ({ ...prev, [key]: value }));

  const updateArray = (key, index, field, value) => {
    setData(prev => {
      const arr = [...(prev[key] || [])];
      if (field) {
        arr[index] = { ...arr[index], [field]: value };
      } else {
        arr[index] = value;
      }
      return { ...prev, [key]: arr };
    });
  };

  const addArrayItem = (key, emptyItem) => {
    setData(prev => ({ ...prev, [key]: [...(prev[key] || []), emptyItem] }));
  };

  const removeArrayItem = (key, index) => {
    setData(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));
  };

  const updateSalaryGroup = (groupIndex, field, value) => {
    setData(prev => {
      const list = [...(prev.salary_details || [])];
      list[groupIndex] = { ...list[groupIndex], [field]: value };
      return { ...prev, salary_details: list };
    });
  };

  const updateSalaryItem = (groupIndex, itemIndex, field, value) => {
    setData(prev => {
      const list = [...(prev.salary_details || [])];
      const items = [...(list[groupIndex].items || [])];
      items[itemIndex] = { ...items[itemIndex], [field]: value };
      list[groupIndex] = { ...list[groupIndex], items };
      return { ...prev, salary_details: list };
    });
  };

  const addSalaryGroup = () => {
    setData(prev => ({
      ...prev,
      salary_details: [
        ...(prev.salary_details || []),
        {
          effective_from: new Date().toISOString().split('T')[0],
          items: [{ pay_head: 'Basic Salary', custom_pay_head: '', rate: '' }]
        }
      ]
    }));
  };

  const removeSalaryGroup = (groupIndex) => {
    setData(prev => ({
      ...prev,
      salary_details: (prev.salary_details || []).filter((_, i) => i !== groupIndex)
    }));
  };

  const addSalaryItem = (groupIndex) => {
    setData(prev => {
      const list = [...(prev.salary_details || [])];
      const items = [...(list[groupIndex].items || []), { pay_head: 'Basic Salary', custom_pay_head: '', rate: '' }];
      list[groupIndex] = { ...list[groupIndex], items };
      return { ...prev, salary_details: list };
    });
  };

  const removeSalaryItem = (groupIndex, itemIndex) => {
    setData(prev => {
      const list = [...(prev.salary_details || [])];
      const items = (list[groupIndex].items || []).filter((_, i) => i !== itemIndex);
      list[groupIndex] = { ...list[groupIndex], items };
      return { ...prev, salary_details: list };
    });
  };

  const handleSave = async () => {
    if (!data.first_name?.trim()) { setError('First Name is required.'); setActiveTab(0); return; }
    if (!data.last_name?.trim()) { setError('Last Name is required.'); setActiveTab(0); return; }
    if (!data.username?.trim()) { setError('Username is required.'); setActiveTab(0); return; }
    if (isAdding && !data.password?.trim()) { setError('Password is required.'); setActiveTab(0); return; }
    setError('');
    setSaving(true);
    const combined = [data.first_name, data.middle_name, data.last_name].filter(Boolean).join(' ');
    try {
      await onSave({ ...data, name: combined });
    } catch (e) {
      setError(e?.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderTab = () => {
    switch (TABS[activeTab].key) {
      case 'basic':      return <BasicTab      data={data} set={set} isAdding={isAdding} shiftsList={shiftsList} departmentsList={departmentsList} />;
      case 'personal':   return <PersonalTab   data={data} set={set} updateArray={updateArray} addArrayItem={addArrayItem} removeArrayItem={removeArrayItem} />;
      case 'family':     return <FamilyTab     data={data} set={set} />;
      case 'identity':   return <IdentityTab   data={data} set={set} />;
      case 'employment': return <EmploymentTab data={data} set={set} updateArray={updateArray} addArrayItem={addArrayItem} removeArrayItem={removeArrayItem} />;
      case 'bank':       return <BankTab       data={data} set={set} updateArray={updateArray} addArrayItem={addArrayItem} removeArrayItem={removeArrayItem} />;
      case 'salary':     return (
        <SalaryTab 
          data={data} 
          updateSalaryGroup={updateSalaryGroup} 
          updateSalaryItem={updateSalaryItem} 
          addSalaryGroup={addSalaryGroup} 
          removeSalaryGroup={removeSalaryGroup} 
          addSalaryItem={addSalaryItem} 
          removeSalaryItem={removeSalaryItem} 
        />
      );
      default:           return null;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
        <View style={s.modal}>

          {/* Header */}
          <View style={s.header}>
            <View>
              <Text style={s.title}>{isAdding ? 'Add New Employee' : 'Edit Employee'}</Text>
              <Text style={s.subtitle}>{TABS[activeTab].label} · Step {activeTab + 1} of {TABS.length}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.textLight} />
            </TouchableOpacity>
          </View>

          {/* Tab Bar */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={s.tabBarContent}>
            {TABS.map((tab, i) => (
              <TouchableOpacity
                key={tab.key}
                style={[s.tab, activeTab === i && s.tabActive]}
                onPress={() => setActiveTab(i)}
              >
                <Ionicons name={tab.icon} size={14} color={activeTab === i ? Colors.brandRed : '#6B7280'} />
                <Text style={[s.tabText, activeTab === i && s.tabTextActive]}>{tab.label}</Text>
                {activeTab === i && <View style={s.tabIndicator} />}
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Error */}
          {error ? (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Form Content */}
          <ScrollView style={s.body} contentContainerStyle={s.bodyContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {renderTab()}
          </ScrollView>

          {/* Footer */}
          <View style={s.footer}>
            <View style={s.footerLeft}>
              {activeTab > 0 && (
                <TouchableOpacity style={s.backBtn} onPress={() => setActiveTab(i => i - 1)}>
                  <Ionicons name="chevron-back" size={16} color={Colors.text} />
                  <Text style={s.backBtnText}>Back</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={s.footerRight}>
              {activeTab < TABS.length - 1 ? (
                <>
                  <TouchableOpacity style={s.skipBtn} onPress={() => setActiveTab(i => i + 1)}>
                    <Text style={s.skipBtnText}>Skip</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.nextBtn} onPress={() => setActiveTab(i => i + 1)}>
                    <Text style={s.nextBtnText}>Next</Text>
                    <Ionicons name="chevron-forward" size={16} color="#fff" />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={s.skipBtn} onPress={onClose}>
                    <Text style={s.skipBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.nextBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                    <Ionicons name={saving ? 'hourglass-outline' : 'checkmark-circle-outline'} size={16} color="#fff" />
                    <Text style={s.nextBtnText}>{saving ? 'Saving...' : isAdding ? 'Create' : 'Update'}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* Progress dots */}
          <View style={s.dots}>
            {TABS.map((_, i) => (
              <View key={i} style={[s.dot, activeTab === i && s.dotActive]} />
            ))}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const EMPTY_USER = {
  first_name: '', middle_name: '', last_name: '', name: '',
  profile_photo: null,
  username: '', password: '', role: 'user', status: 'active', shift: 'day',
  phones: [''], email: '', employee_id: '', department: '', designation: '',
  employment_type: '', date_of_joining: '', work_location: '', company_phone: '',
  date_of_birth: '', gender: '', marital_status: '', nationality: '',
  blood_group: '', personal_emails: [''], current_address: '', permanent_address: '',
  emergency_contacts: [{ name: '', rel: '', phone: '' }],
  father_name: '', mother_name: '', spouse_name: '', family_mobile: '',
  pan_number: '', aadhaar_number: '', passport_number: '',
  uan_number: '', pf_number: '', esic_number: '',
  highest_qualification: '', specialization: '',
  previous_employments: [{ company: '', designation: '', experience: '', salary: '' }],
  bank_details: [{ bank_name: '', account_holder: '', account_number: '', ifsc_code: '', branch_name: '' }],
  salary_details: [{
    effective_from: '',
    items: [
      { pay_head: 'Basic Salary', custom_pay_head: '', rate: '' },
      { pay_head: 'HRA', custom_pay_head: '', rate: '' }
    ]
  }],
  doc_pan: null, doc_aadhaar: null, doc_passport: null, doc_uan: null, doc_qualification: null,
  permissions: { checkin_outside: false },
  checkin_policy: 'always',
};

// ── Styles ────────────────────────────────────────────────────────────────────

const f = StyleSheet.create({
  wrap:        { flex: 1, marginBottom: 8 },
  row:         { flexDirection: 'row', gap: 8 },
  label:       { fontSize: 10, fontWeight: '700', color: '#374151', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.4 },
  input:       { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 0, height: 36, fontSize: 13, color: Colors.text, backgroundColor: '#fff' },
  select:      { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff' },
  selectText:  { fontSize: 13, color: Colors.text, flex: 1 },
  dropdown:    { position: 'absolute', top: 54, left: 0, right: 0, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', zIndex: 999, elevation: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
  dropdownItem:{ paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dropdownItemActive: { backgroundColor: '#FEF2F2' },
  dropdownText:{ fontSize: 13, color: Colors.text },
  sectionTitle:{ fontSize: 12, fontWeight: '700', color: Colors.brandRed, marginTop: 4, marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#FEE2E2' },
  avatarWrap:  { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F3F4F6', borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg:   { width: 80, height: 80, borderRadius: 40 },
  avatarBadge: { position: 'absolute', bottom: 2, right: 2, backgroundColor: Colors.brandRed, borderRadius: 10, width: 22, height: 22, justifyContent: 'center', alignItems: 'center' },
  docWrap:          { marginTop: 4 },
  docBtn:           { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#F9FAFB' },
  docText:          { fontSize: 11, color: '#6B7280', flex: 1 },
  fieldDocRow:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  docInlineBtn:     { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 2 },
  popupOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 30 },
  popupBox:         { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 320, paddingTop: 20, paddingBottom: 8, overflow: 'hidden' },
  popupTitle:       { fontSize: 15, fontWeight: '700', color: Colors.text, paddingHorizontal: 20, marginBottom: 14 },
  popupOption:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  popupIconBox:     { width: 42, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  popupOptionTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  popupOptionSub:   { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  popupDivider:     { height: 1, backgroundColor: '#F3F4F6', marginVertical: 6, marginHorizontal: 20 },
  popupFileTitle:   { fontSize: 11, fontWeight: '700', color: '#6B7280', paddingHorizontal: 20, marginBottom: 4, textTransform: 'uppercase' },
  popupFile:        { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 6 },
  popupFileName:    { fontSize: 12, color: Colors.brandRed, flex: 1 },
  popupCloseBtn:    { alignItems: 'center', paddingVertical: 14, marginTop: 4, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  popupCloseTxt:    { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  popupTile:        { flex: 1, alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 16, gap: 6 },
  popupTileIcon:    { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  popupTileTitle:   { fontSize: 13, fontWeight: '700', color: '#111827' },
  popupTileSub:     { fontSize: 10, color: '#9CA3AF', textAlign: 'center' },
});

const s = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modal:        { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 680, height: '95%', overflow: 'hidden' },
  header:       { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  title:        { fontSize: 18, fontWeight: '700', color: Colors.text },
  subtitle:     { fontSize: 12, color: Colors.textLight, marginTop: 2 },
  closeBtn:     { padding: 4 },
  tabBar:       { borderBottomWidth: 1, borderBottomColor: '#F3F4F6', flexGrow: 0 },
  tabBarContent:{ flexDirection: 'row', paddingHorizontal: 16 },
  tab:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 9, paddingHorizontal: 12, position: 'relative' },
  tabActive:    {},
  tabText:      { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  tabTextActive:{ color: Colors.brandRed },
  tabIndicator: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: Colors.brandRed, borderRadius: 2 },
  errorBox:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', marginHorizontal: 20, marginTop: 8, padding: 10, borderRadius: 8 },
  errorText:    { fontSize: 13, color: '#DC2626', flex: 1 },
  body:         { flex: 1 },
  bodyContent:  { padding: 14, paddingBottom: 6 },
  footer:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  footerLeft:   { flex: 1 },
  footerRight:  { flexDirection: 'row', gap: 10 },
  backBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 12 },
  backBtnText:  { fontSize: 14, fontWeight: '600', color: Colors.text },
  skipBtn:      { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1.5, borderColor: '#E5E7EB' },
  skipBtnText:  { fontSize: 14, fontWeight: '600', color: Colors.textLight },
  nextBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.brandRed, paddingVertical: 9, paddingHorizontal: 20, borderRadius: 10 },
  nextBtnText:  { fontSize: 14, fontWeight: '700', color: '#fff' },
  dots:         { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 12 },
  dot:          { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E5E7EB' },
  dotActive:    { backgroundColor: Colors.brandRed, width: 18 },
});

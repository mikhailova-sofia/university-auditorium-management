'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = '/api'

interface User {
  id: number
  email: string
  full_name: string
  role: 'student' | 'teacher' | 'admin'
}

interface Auditorium {
  id: number
  number: string
  capacity: number
  floor: number
  building: string
  equipment: string
}

interface Booking {
  id: number
  auditorium_id: number
  auditorium_number?: string
  building?: string
  floor?: number
  subject: string
  teacher: string
  group_name: string
  start_time: string
  end_time: string
  day_of_week: number
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [showLogin, setShowLogin] = useState(true)
  const [activeTab, setActiveTab] = useState<'auditoriums' | 'bookings' | 'availability'>('auditoriums')
  const [auditoriums, setAuditoriums] = useState<Auditorium[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState<'auditorium' | 'booking'>('auditorium')
  const [editingItem, setEditingItem] = useState<Auditorium | Booking | null>(null)
  const [formData, setFormData] = useState<any>({})
  const [loginData, setLoginData] = useState({ email: '', password: '' })
  const [registerData, setRegisterData] = useState({ email: '', password: '', full_name: '', role: 'student' as 'student' | 'teacher' })
  const [selectedAuditorium, setSelectedAuditorium] = useState<number | null>(null)
  const [availability, setAvailability] = useState<Booking[]>([])

  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    if (savedToken) {
      setToken(savedToken)
      checkAuth(savedToken)
    }
  }, [])

  useEffect(() => {
    if (token && user) {
      loadAuditoriums()
      loadBookings()
    }
  }, [token, user])

  const checkAuth = async (authToken: string) => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      setUser(response.data.user)
      setShowLogin(false)
    } catch (error) {
      localStorage.removeItem('token')
      setToken(null)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await axios.post(`${API_URL}/auth/login`, loginData)
      const { token: newToken, user: userData } = response.data
      
      if (!newToken || !userData) {
        throw new Error('Неверный формат ответа от сервера')
      }
      
      setToken(newToken)
      setUser(userData)
      localStorage.setItem('token', newToken)
      setShowLogin(false)
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Ошибка входа. Проверьте подключение к серверу.'
      alert(errorMessage)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await axios.post(`${API_URL}/auth/register`, registerData)
      const { token: newToken, user: userData } = response.data
      setToken(newToken)
      setUser(userData)
      localStorage.setItem('token', newToken)
      setShowLogin(false)
    } catch (error: any) {
      alert(error.response?.data?.error || 'Ошибка регистрации')
    }
  }

  const handleLogout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    setShowLogin(true)
  }

  const getAuthHeaders = () => ({
    headers: { Authorization: `Bearer ${token}` }
  })

  const loadAuditoriums = async () => {
    try {
      const response = await axios.get(`${API_URL}/auditoriums`, getAuthHeaders())
      setAuditoriums(response.data)
    } catch (error: any) {
      if (error.response?.status === 401) {
        handleLogout()
      }
    }
  }

  const loadBookings = async () => {
    try {
      const response = await axios.get(`${API_URL}/bookings`, getAuthHeaders())
      setBookings(response.data)
    } catch (error: any) {
      if (error.response?.status === 401) {
        handleLogout()
      }
    }
  }

  const loadAvailability = async (auditoriumId: number) => {
    try {
      const response = await axios.get(`${API_URL}/auditoriums/${auditoriumId}/availability`, getAuthHeaders())
      setAvailability(response.data)
    } catch (error: any) {
      if (error.response?.status === 401) {
        handleLogout()
      }
    }
  }


  const openModal = (type: 'auditorium' | 'booking', item?: Auditorium | Booking) => {
    setModalType(type)
    setEditingItem(item || null)
    if (type === 'auditorium') {
      setFormData(item ? { ...item } : {
        number: '',
        capacity: '',
        floor: '',
        building: '',
        equipment: ''
      })
    } else {
      setFormData(item ? { ...item } : {
        auditorium_id: '',
        subject: '',
        teacher: user?.full_name || '',
        group_name: '',
        start_time: '',
        end_time: '',
        day_of_week: 0
      })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingItem(null)
    setFormData({})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (modalType === 'auditorium') {
        if (editingItem) {
          await axios.put(`${API_URL}/auditoriums/${(editingItem as Auditorium).id}`, formData, getAuthHeaders())
        } else {
          await axios.post(`${API_URL}/auditoriums`, formData, getAuthHeaders())
        }
        loadAuditoriums()
      } else {
        if (editingItem) {
          // Обновление занятий пока не реализовано в API
          alert('Обновление занятий пока не поддерживается')
        } else {
          await axios.post(`${API_URL}/bookings`, formData, getAuthHeaders())
        }
        loadBookings()
        if (selectedAuditorium) {
          loadAvailability(selectedAuditorium)
        }
      }
      closeModal()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Ошибка сохранения')
    }
  }

  const handleDelete = async (type: 'auditorium' | 'booking', id: number) => {
    if (!confirm('Вы уверены, что хотите удалить?')) return
    
    try {
      if (type === 'auditorium') {
        await axios.delete(`${API_URL}/auditoriums/${id}`, getAuthHeaders())
        loadAuditoriums()
      } else {
        await axios.delete(`${API_URL}/bookings/${id}`, getAuthHeaders())
        loadBookings()
        if (selectedAuditorium) {
          loadAvailability(selectedAuditorium)
        }
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Ошибка удаления')
    }
  }

  const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']

  if (showLogin || !user) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h2>🏛️ Вход в систему</h2>
          <div className="login-forms-wrapper">
            <div className="login-section">
              <h3 style={{ marginBottom: '20px', color: '#2d3748', fontSize: '20px', fontWeight: 600 }}>Вход</h3>
              <form onSubmit={handleLogin} className="login-form">
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    required
                    placeholder="email@university.ru"
                  />
                </div>
                <div className="form-group">
                  <label>Пароль</label>
                  <input
                    type="password"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    required
                    placeholder="Введите пароль"
                  />
                </div>
                <button type="submit" className="button" style={{ width: '100%' }}>
                  Войти
                </button>
              </form>
            </div>
            
            <div className="register-section">
              <h3 style={{ marginBottom: '20px', color: '#2d3748', fontSize: '20px', fontWeight: 600 }}>Регистрация</h3>
              <form onSubmit={handleRegister} className="register-form">
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    required
                    placeholder="email@university.ru"
                  />
                </div>
                <div className="form-group">
                  <label>ФИО</label>
                  <input
                    type="text"
                    value={registerData.full_name}
                    onChange={(e) => setRegisterData({ ...registerData, full_name: e.target.value })}
                    required
                    placeholder="Иванов Иван Иванович"
                  />
                </div>
                <div className="form-group">
                  <label>Роль</label>
                  <select
                    value={registerData.role}
                    onChange={(e) => setRegisterData({ ...registerData, role: e.target.value as 'student' | 'teacher' })}
                    required
                  >
                    <option value="student">Студент</option>
                    <option value="teacher">Преподаватель</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Пароль</label>
                  <input
                    type="password"
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    required
                    placeholder="Минимум 6 символов"
                  />
                </div>
                <button type="submit" className="button button-success" style={{ width: '100%' }}>
                  Зарегистрироваться
                </button>
              </form>
            </div>
          </div>
          
          <div className="test-accounts-info">
            <p style={{ marginTop: '30px', fontSize: '13px', color: '#718096', textAlign: 'center', lineHeight: '1.6' }}>
              <strong style={{ color: '#2d3748', display: 'block', marginBottom: '10px' }}>Тестовые аккаунты:</strong>
              Преподаватель: <code style={{ background: '#f7fafc', padding: '2px 6px', borderRadius: '4px' }}>ivanov@university.ru</code> / <code style={{ background: '#f7fafc', padding: '2px 6px', borderRadius: '4px' }}>teacher123</code><br/>
              Студент: <code style={{ background: '#f7fafc', padding: '2px 6px', borderRadius: '4px' }}>student1@university.ru</code> / <code style={{ background: '#f7fafc', padding: '2px 6px', borderRadius: '4px' }}>student123</code><br/>
              Админ: <code style={{ background: '#f7fafc', padding: '2px 6px', borderRadius: '4px' }}>admin@university.ru</code> / <code style={{ background: '#f7fafc', padding: '2px 6px', borderRadius: '4px' }}>admin123</code>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="header">
        <h1>🏛️ Учет занятости аудиторий ВУЗа</h1>
        <div className="user-info">
          <span className={`user-badge ${user.role}`}>
            {user.role === 'student' ? '👨‍🎓 Студент' : user.role === 'teacher' ? '👨‍🏫 Преподаватель' : '👑 Администратор'}
          </span>
          <span style={{ color: '#2d3748', fontWeight: 600 }}>{user.full_name}</span>
          <button className="button button-danger" onClick={handleLogout} style={{ padding: '8px 16px', fontSize: '14px' }}>
            Выйти
          </button>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'auditoriums' ? 'active' : ''}`}
          onClick={() => setActiveTab('auditoriums')}
        >
          📚 Аудитории
        </button>
        <button
          className={`tab ${activeTab === 'bookings' ? 'active' : ''}`}
          onClick={() => setActiveTab('bookings')}
        >
          📅 Расписание
        </button>
        {(user.role === 'teacher' || user.role === 'admin') && (
          <button
            className={`tab ${activeTab === 'availability' ? 'active' : ''}`}
            onClick={() => setActiveTab('availability')}
          >
            🔍 Занятость
          </button>
        )}
      </div>

      {activeTab === 'auditoriums' && (
        <div className="card">
          <div className="card-header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
            <h2 style={{ margin: 0, fontSize: '24px', color: '#2d3748' }}>Список аудиторий</h2>
            {user.role === 'admin' && (
              <button className="button" onClick={() => openModal('auditorium')}>
                + Добавить аудиторию
              </button>
            )}
          </div>

          <div className="table-wrapper">
            <table className="table">
            <thead>
              <tr>
                <th>Номер</th>
                <th>Корпус</th>
                <th>Этаж</th>
                <th>Вместимость</th>
                <th>Оборудование</th>
                {user.role === 'admin' && <th>Действия</th>}
              </tr>
            </thead>
            <tbody>
              {auditoriums.map((aud) => (
                <tr key={aud.id}>
                  <td style={{ fontWeight: 600, color: '#667eea' }}>{aud.number}</td>
                  <td>{aud.building}</td>
                  <td>{aud.floor} этаж</td>
                  <td>{aud.capacity} мест</td>
                  <td>{aud.equipment || '-'}</td>
                  {user.role === 'admin' && (
                    <td>
                      <button className="button button-secondary" onClick={() => openModal('auditorium', aud)} style={{ padding: '6px 12px', fontSize: '14px', marginRight: '5px' }}>
                        ✏️
                      </button>
                      <button className="button button-danger" onClick={() => handleDelete('auditorium', aud.id)} style={{ padding: '6px 12px', fontSize: '14px' }}>
                        🗑️
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'bookings' && (
        <div className="card">
          <div className="card-header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
            <h2 style={{ margin: 0, fontSize: '24px', color: '#2d3748' }}>Расписание занятий</h2>
            {(user.role === 'teacher' || user.role === 'admin') && (
              <button className="button" onClick={() => openModal('booking')}>
                + Добавить занятие
              </button>
            )}
          </div>

          <div className="table-wrapper">
            <table className="table">
            <thead>
              <tr>
                <th>Аудитория</th>
                <th>Предмет</th>
                <th>Преподаватель</th>
                <th>Группа</th>
                <th>День недели</th>
                <th>Время</th>
                {(user.role === 'teacher' || user.role === 'admin') && <th>Действия</th>}
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id}>
                  <td style={{ fontWeight: 600 }}>{booking.auditorium_number} ({booking.building})</td>
                  <td>{booking.subject}</td>
                  <td>{booking.teacher}</td>
                  <td>{booking.group_name}</td>
                  <td>{dayNames[booking.day_of_week]}</td>
                  <td>{booking.start_time} - {booking.end_time}</td>
                  {(user.role === 'teacher' || user.role === 'admin') && (
                    <td>
                      <button className="button button-danger" onClick={() => handleDelete('booking', booking.id)} style={{ padding: '6px 12px', fontSize: '14px' }}>
                        🗑️
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'availability' && (user.role === 'teacher' || user.role === 'admin') && (
        <div className="card">
          <h2 style={{ marginBottom: '20px', fontSize: '24px', color: '#2d3748' }}>Проверка занятости аудиторий</h2>
          <div className="form-group">
            <label>Выберите аудиторию</label>
            <select
              value={selectedAuditorium || ''}
              onChange={(e) => {
                const id = parseInt(e.target.value)
                setSelectedAuditorium(id)
                if (id) loadAvailability(id)
              }}
            >
              <option value="">Выберите аудиторию</option>
              {auditoriums.map((aud) => (
                <option key={aud.id} value={aud.id}>
                  {aud.number} ({aud.building}, {aud.floor} этаж)
                </option>
              ))}
            </select>
          </div>

          {selectedAuditorium && availability.length > 0 && (
            <div className="table-wrapper" style={{ marginTop: '20px' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Предмет</th>
                    <th>Группа</th>
                    <th>День недели</th>
                    <th>Время</th>
                  </tr>
                </thead>
                <tbody>
                  {availability.map((booking) => (
                    <tr key={booking.id}>
                      <td>{booking.subject}</td>
                      <td>{booking.group_name}</td>
                      <td>{dayNames[booking.day_of_week]}</td>
                      <td>{booking.start_time} - {booking.end_time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedAuditorium && availability.length === 0 && (
            <p style={{ textAlign: 'center', color: '#718096', marginTop: '20px' }}>
              Аудитория свободна
            </p>
          )}
        </div>
      )}

      {showModal && (
        <div className="modal" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {editingItem ? 'Редактировать' : 'Добавить'} {modalType === 'auditorium' ? 'аудиторию' : 'занятие'}
              </h2>
              <button className="close-button" onClick={closeModal}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              {modalType === 'auditorium' ? (
                <>
                  <div className="form-group">
                    <label>Номер аудитории *</label>
                    <input
                      type="text"
                      value={formData.number || ''}
                      onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Корпус *</label>
                    <input
                      type="text"
                      value={formData.building || ''}
                      onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Этаж *</label>
                    <input
                      type="number"
                      value={formData.floor || ''}
                      onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Вместимость *</label>
                    <input
                      type="number"
                      value={formData.capacity || ''}
                      onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Оборудование</label>
                    <input
                      type="text"
                      value={formData.equipment || ''}
                      onChange={(e) => setFormData({ ...formData, equipment: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label>Аудитория *</label>
                    <select
                      value={formData.auditorium_id || ''}
                      onChange={(e) => setFormData({ ...formData, auditorium_id: parseInt(e.target.value) })}
                      required
                    >
                      <option value="">Выберите аудиторию</option>
                      {auditoriums.map((aud) => (
                        <option key={aud.id} value={aud.id}>
                          {aud.number} ({aud.building})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Предмет *</label>
                    <input
                      type="text"
                      value={formData.subject || ''}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Преподаватель *</label>
                    <input
                      type="text"
                      value={formData.teacher || ''}
                      onChange={(e) => setFormData({ ...formData, teacher: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Группа *</label>
                    <input
                      type="text"
                      value={formData.group_name || ''}
                      onChange={(e) => setFormData({ ...formData, group_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>День недели *</label>
                    <select
                      value={formData.day_of_week || 0}
                      onChange={(e) => setFormData({ ...formData, day_of_week: parseInt(e.target.value) })}
                      required
                    >
                      {dayNames.map((day, index) => (
                        <option key={index} value={index}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Время начала (HH:MM) *</label>
                    <input
                      type="time"
                      value={formData.start_time || ''}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Время окончания (HH:MM) *</label>
                    <input
                      type="time"
                      value={formData.end_time || ''}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      required
                    />
                  </div>
                </>
              )}

              <div style={{ marginTop: '25px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="button button-secondary" onClick={closeModal}>
                  Отмена
                </button>
                <button type="submit" className="button">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

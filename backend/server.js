const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'auditoriums.db');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Создаем директорию для БД если её нет
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Инициализация базы данных
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Ошибка подключения к БД:', err.message);
  } else {
    console.log('Подключено к SQLite базе данных');
    initDatabase();
  }
});

// Инициализация таблиц
function initDatabase() {
  db.serialize(() => {
    // Таблица пользователей
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица аудиторий
    db.run(`CREATE TABLE IF NOT EXISTS auditoriums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      floor INTEGER NOT NULL,
      building TEXT NOT NULL,
      equipment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(number, building)
    )`);

    // Таблица занятий
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auditorium_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      teacher TEXT NOT NULL,
      group_name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      day_of_week INTEGER NOT NULL,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (auditorium_id) REFERENCES auditoriums(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`);

    // Индексы для оптимизации
    db.run(`CREATE INDEX IF NOT EXISTS idx_bookings_auditorium ON bookings(auditorium_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_bookings_time ON bookings(start_time, end_time)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);

    // Seed данные - вызываем после создания всех таблиц
    setTimeout(() => {
      seedDatabase();
    }, 500);
  });
}

// Seed данные
function seedDatabase() {
  // Проверяем, есть ли уже данные
  db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
    if (err) {
      return;
    }
    
    if (row && row.count > 0) {
      return;
    }

    // Создаем пользователей
    const users = [
      { email: 'admin@university.ru', password: 'admin123', full_name: 'Администратор', role: 'admin' },
      { email: 'ivanov@university.ru', password: 'teacher123', full_name: 'Иванов Иван Иванович', role: 'teacher' },
      { email: 'petrov@university.ru', password: 'teacher123', full_name: 'Петров Петр Петрович', role: 'teacher' },
      { email: 'sidorov@university.ru', password: 'teacher123', full_name: 'Сидоров Сидор Сидорович', role: 'teacher' },
      { email: 'student1@university.ru', password: 'student123', full_name: 'Студент Тестовый', role: 'student' },
    ];

    users.forEach((user, index) => {
      const hashedPassword = bcrypt.hashSync(user.password, 10);
      db.run(
        'INSERT OR IGNORE INTO users (email, password, full_name, role) VALUES (?, ?, ?, ?)',
        [user.email, hashedPassword, user.full_name, user.role],
        function(err) {
          if (err) {
            // Ошибка создания пользователя
          }
        }
      );
    });

    // Проверяем аудитории
    db.get('SELECT COUNT(*) as count FROM auditoriums', (err, audRow) => {
      if (err) {
        return;
      }

      if (audRow && audRow.count > 0) {
        return;
      }

      // Создаем аудитории
      const auditoriums = [
        { number: '101', capacity: 30, floor: 1, building: 'Главный корпус', equipment: 'Проектор, доска' },
        { number: '102', capacity: 25, floor: 1, building: 'Главный корпус', equipment: 'Интерактивная доска' },
        { number: '201', capacity: 50, floor: 2, building: 'Главный корпус', equipment: 'Проектор, микрофон' },
        { number: '202', capacity: 40, floor: 2, building: 'Главный корпус', equipment: 'Компьютеры (20 шт)' },
        { number: '301', capacity: 100, floor: 3, building: 'Главный корпус', equipment: 'Проектор, звуковая система' },
        { number: '302', capacity: 60, floor: 3, building: 'Главный корпус', equipment: 'Проектор' },
        { number: '401', capacity: 35, floor: 4, building: 'Главный корпус', equipment: 'Лабораторное оборудование' },
        { number: '501', capacity: 45, floor: 5, building: 'Главный корпус', equipment: 'Компьютеры (25 шт)' },
        { number: '101', capacity: 20, floor: 1, building: 'Корпус Б', equipment: 'Проектор' },
        { number: '201', capacity: 30, floor: 2, building: 'Корпус Б', equipment: 'Интерактивная доска' },
      ];

      let inserted = 0;
      auditoriums.forEach(aud => {
        db.run(
          'INSERT OR IGNORE INTO auditoriums (number, capacity, floor, building, equipment) VALUES (?, ?, ?, ?, ?)',
          [aud.number, aud.capacity, aud.floor, aud.building, aud.equipment],
          function(err) {
            if (!err && this.changes > 0) {
              inserted++;
            }
          }
        );
      });

      setTimeout(() => {
        // Создаем примеры занятий
        setTimeout(() => {
          db.get('SELECT id FROM auditoriums LIMIT 1', (err, aud) => {
            if (!err && aud) {
              const bookings = [
                { auditorium_id: aud.id, subject: 'Математика', teacher: 'Иванов И.И.', group_name: 'Группа 1', start_time: '09:00', end_time: '10:30', day_of_week: 1 },
                { auditorium_id: aud.id, subject: 'Физика', teacher: 'Петров П.П.', group_name: 'Группа 2', start_time: '11:00', end_time: '12:30', day_of_week: 1 },
                { auditorium_id: aud.id, subject: 'Информатика', teacher: 'Сидоров С.С.', group_name: 'Группа 3', start_time: '14:00', end_time: '15:30', day_of_week: 2 },
              ];

              bookings.forEach(booking => {
                db.run(
                  'INSERT OR IGNORE INTO bookings (auditorium_id, subject, teacher, group_name, start_time, end_time, day_of_week) VALUES (?, ?, ?, ?, ?, ?, ?)',
                  [booking.auditorium_id, booking.subject, booking.teacher, booking.group_name, booking.start_time, booking.end_time, booking.day_of_week]
                );
              });
            }
          });
        }, 500);
      }, 1000);
    });
  });
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware для проверки JWT токена
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Токен доступа отсутствует' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Недействительный токен' });
    }
    req.user = user;
    next();
  });
}

// Middleware для проверки роли
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Требуется аутентификация' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав доступа' });
    }
    next();
  };
}

// ========== AUTH ROUTES ==========

// Регистрация
app.post('/api/auth/register', async (req, res) => {
  const { email, password, full_name, role = 'student' } = req.body;

  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'Необходимы поля: email, password, full_name' });
  }

  if (!['student', 'teacher'].includes(role)) {
    return res.status(400).json({ error: 'Роль должна быть student или teacher' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    'INSERT INTO users (email, password, full_name, role) VALUES (?, ?, ?, ?)',
    [email, hashedPassword, full_name, role],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint')) {
          return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
        }
        return res.status(500).json({ error: err.message });
      }

      const token = jwt.sign(
        { id: this.lastID, email, role, full_name },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        token,
        user: { id: this.lastID, email, full_name, role }
      });
    }
  );
});

// Вход
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Необходимы email и password' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role }
    });
  });
});

// Получить текущего пользователя
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// ========== AUDITORIUMS ROUTES ==========

// Получить все аудитории (все могут видеть)
app.get('/api/auditoriums', authenticateToken, (req, res) => {
  db.all('SELECT * FROM auditoriums ORDER BY building, floor, number', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Получить аудиторию по ID
app.get('/api/auditoriums/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM auditoriums WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Аудитория не найдена' });
    }
    res.json(row);
  });
});

// Проверить занятость аудитории (только преподаватели и админы)
app.get('/api/auditoriums/:id/availability', authenticateToken, requireRole('teacher', 'admin'), (req, res) => {
  const id = req.params.id;
  const { date, day_of_week } = req.query;

  let query = `
    SELECT b.*, a.number as auditorium_number
    FROM bookings b
    JOIN auditoriums a ON b.auditorium_id = a.id
    WHERE b.auditorium_id = ?
  `;
  const params = [id];

  if (day_of_week !== undefined) {
    query += ' AND b.day_of_week = ?';
    params.push(day_of_week);
  }

  query += ' ORDER BY b.start_time';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Получить свободные аудитории по времени (только преподаватели и админы)
app.get('/api/auditoriums/available', authenticateToken, requireRole('teacher', 'admin'), (req, res) => {
  const { day_of_week, start_time, end_time } = req.query;

  if (day_of_week === undefined || day_of_week === null || day_of_week === '' || !start_time || !end_time) {
    return res.status(400).json({ error: 'Необходимы параметры: day_of_week, start_time, end_time' });
  }

  const dayOfWeekNum = parseInt(day_of_week);
  if (isNaN(dayOfWeekNum) || dayOfWeekNum < 0 || dayOfWeekNum > 6) {
    return res.status(400).json({ error: 'day_of_week должен быть числом от 0 до 6' });
  }

  // Проверяем, что время окончания больше времени начала
  if (start_time >= end_time) {
    return res.status(400).json({ error: 'Время окончания должно быть больше времени начала' });
  }

  // Получаем все аудитории
  db.all('SELECT * FROM auditoriums ORDER BY building, floor, number', (err, allAuditoriums) => {
    if (err) {
      console.error('Ошибка получения аудиторий:', err);
      return res.status(500).json({ error: err.message });
    }

    if (!allAuditoriums || allAuditoriums.length === 0) {
      return res.json([]);
    }

    // Получаем занятые аудитории в это время
    // Упрощенная проверка: аудитория занята, если есть пересечение интервалов
    // Интервалы пересекаются, если: start_time < end_time_booking AND end_time > start_time_booking
    db.all(
      `SELECT DISTINCT auditorium_id 
       FROM bookings 
       WHERE day_of_week = ? 
       AND start_time < ? 
       AND end_time > ?`,
      [dayOfWeekNum, end_time, start_time],
      (err, bookedAuditoriums) => {
        if (err) {
          console.error('Ошибка получения занятых аудиторий:', err);
          return res.status(500).json({ error: err.message });
        }

        const bookedIds = new Set((bookedAuditoriums || []).map(b => b.auditorium_id));
        const availableAuditoriums = allAuditoriums.filter(aud => !bookedIds.has(aud.id));
        
        res.json(availableAuditoriums);
      }
    );
  });
});

// Создать аудиторию (только админы)
app.post('/api/auditoriums', authenticateToken, requireRole('admin'), (req, res) => {
  const { number, capacity, floor, building, equipment } = req.body;
  
  if (!number || !capacity || !floor || !building) {
    return res.status(400).json({ error: 'Необходимы поля: number, capacity, floor, building' });
  }

  db.run(
    'INSERT INTO auditoriums (number, capacity, floor, building, equipment) VALUES (?, ?, ?, ?, ?)',
    [number, capacity, floor, building, equipment || ''],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint')) {
          return res.status(409).json({ error: 'Аудитория с таким номером уже существует' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: this.lastID, ...req.body });
    }
  );
});

// Обновить аудиторию (только админы)
app.put('/api/auditoriums/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const id = req.params.id;
  const { number, capacity, floor, building, equipment } = req.body;
  
  db.run(
    'UPDATE auditoriums SET number = ?, capacity = ?, floor = ?, building = ?, equipment = ? WHERE id = ?',
    [number, capacity, floor, building, equipment || '', id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Аудитория не найдена' });
      }
      res.json({ id, ...req.body });
    }
  );
});

// Удалить аудиторию (только админы)
app.delete('/api/auditoriums/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM auditoriums WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Аудитория не найдена' });
    }
    db.run('DELETE FROM bookings WHERE auditorium_id = ?', [id]);
    res.json({ message: 'Аудитория удалена' });
  });
});

// ========== BOOKINGS ROUTES ==========

// Получить все занятия (студенты видят только свои группы, преподаватели - все)
app.get('/api/bookings', authenticateToken, (req, res) => {
  const { auditorium_id, day_of_week } = req.query;
  let query = `
    SELECT b.*, a.number as auditorium_number, a.building, a.floor
    FROM bookings b
    JOIN auditoriums a ON b.auditorium_id = a.id
  `;
  const params = [];

  // Студенты видят только занятия своей группы (если указана)
  if (req.user.role === 'student') {
    // Для студентов показываем все занятия, но можно фильтровать по группе
    // В реальном приложении здесь была бы связь с группами студентов
  }

  if (auditorium_id) {
    query += params.length > 0 ? ' AND' : ' WHERE';
    query += ' b.auditorium_id = ?';
    params.push(auditorium_id);
  }

  if (day_of_week !== undefined) {
    query += params.length > 0 ? ' AND' : ' WHERE';
    query += ' b.day_of_week = ?';
    params.push(day_of_week);
  }

  query += ' ORDER BY b.day_of_week, b.start_time';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Создать занятие (только преподаватели и админы)
app.post('/api/bookings', authenticateToken, requireRole('teacher', 'admin'), (req, res) => {
  const { auditorium_id, subject, teacher, group_name, start_time, end_time, day_of_week } = req.body;
  
  if (!auditorium_id || !subject || !teacher || !group_name || !start_time || !end_time || day_of_week === undefined) {
    return res.status(400).json({ error: 'Необходимы все поля' });
  }

  // Проверка конфликтов
  db.get(
    `SELECT * FROM bookings 
     WHERE auditorium_id = ? 
     AND day_of_week = ? 
     AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?))`,
    [auditorium_id, day_of_week, start_time, start_time, end_time, end_time],
    (err, conflict) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (conflict) {
        return res.status(409).json({ error: 'Аудитория уже занята в это время' });
      }

      db.run(
        'INSERT INTO bookings (auditorium_id, subject, teacher, group_name, start_time, end_time, day_of_week, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [auditorium_id, subject, teacher, group_name, start_time, end_time, day_of_week, req.user.id],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.status(201).json({ id: this.lastID, ...req.body });
        }
      );
    }
  );
});

// Удалить занятие (только создатель, преподаватели и админы)
app.delete('/api/bookings/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  
  // Проверяем, может ли пользователь удалить это занятие
  db.get('SELECT created_by FROM bookings WHERE id = ?', [id], (err, booking) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!booking) {
      return res.status(404).json({ error: 'Занятие не найдено' });
    }

    // Может удалить только создатель, преподаватель или админ
    if (booking.created_by !== req.user.id && req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Недостаточно прав для удаления' });
    }

    db.run('DELETE FROM bookings WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Занятие не найдено' });
      }
      res.json({ message: 'Занятие удалено' });
    });
  });
});

// Получить статистику (только преподаватели и админы)
app.get('/api/stats', authenticateToken, requireRole('teacher', 'admin'), (req, res) => {
  db.all(`
    SELECT 
      a.id,
      a.number,
      a.building,
      COUNT(b.id) as bookings_count
    FROM auditoriums a
    LEFT JOIN bookings b ON a.id = b.auditorium_id
    GROUP BY a.id, a.number, a.building
    ORDER BY bookings_count DESC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'backend' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend сервер запущен на порту ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Соединение с БД закрыто');
    process.exit(0);
  });
});

import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

// Embedded service account for seeding (provided by user)
const serviceAccount = {
  "type": "service_account",
  "project_id": "video-modeling-c46ff",
  "private_key_id": "6241a3c076d0663a96ac1650b70b60271603330e",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC2f8wD7LJq9tuf\n4mrdH0WLJGq1GpN0q7LotMk6nD7zJxwKbrMY/+T63we+ZNz51F6WIg2QCiu+UwX4\nUvdeTadyZXeSuPDmbdFDE18GOq83DrUd4qu/4XcI+h2xNagYKM1tvGljAcA8zpAp\nmoBEgftsL/JjS7C5vD7ukSz6J/Jf8qUYuzUvy3uCD+BHbJ556ZSxuyUUKO3R6aRd\nugSLUZ8tEI2aUfFIJxMr8njYD6peXZAmWzPva0ddBvmBOCPPlY9vilBC564NZFiq\nY0nnpRV287aSELU5owLTAmDkbc3js28voDssKT5ZHvgvF4m+YUVEn6Dew2h5dtln\nDufCAmIjAgMBAAECggEAQx7SgpkB78w172JfSk9PjQLKSixpki36AZNINUm070nx\nira3IRkwdsIjf3dqPGpKlW4VzeWnu/qeBfxBpYnq7Wx7I1fopd866TANMWXQ/m9m\n1oSBBXPfi0ouNHhXB/etwk/a9MJ2mQahx+NejJO/zEUAIVv7tfwRqz1yrNiXUIj2\n4f1WkcmJdhIBwteFGKvdO1R9cK0HOsJzhBcwmL9fBQUoUpDVFwnMfv8h91L6fJLC\nZGIoqhPIoRGrSO5tv+9cmntx60lIuCI3peeipKXKFawc1o8AO2rmfOm9tfUI28U1\nW4/0grZqw4n2097nywjGfiRaHa+MW0Ldq2Oai++0SQKBgQDhtdALT5A25nYXHMNk\n3+P1MLVudHJ5xD0NUwK9rkN6VzApIItQiDqoXSLyhqniCB/zuyfWxj6ggdzUyNxH\ne1AJ4qFlNwfn/pESZH1zvzrTPU9Rr+ZJskNMH5PMgMc/mwNB8Yt37l8eab99sRU5\nd0aCiNFlWm1MndAPzMDJRBGVmwKBgQDO/XyskdJlG0Tn2LvoYx4p4ZRdWTN9C9W4\nwIWNoYfs2UX4238vXjfR1nTP8Tczkz/mcdU0QePE64c4jxFlVvvodtV3kuqPIK9Y\nsDWq8v4q7b+pvJiaZOx3ufovLPYPa3cq+jXgs601roZc5iDR/bKcuPCKWu86uA2m\nvK/y1Z+yGQKBgA0Vc/zj3NFB5MCMO0tiqx0weKPxfh1O4dce477JFkJGQZVwvIKr\kvLlizwR0FE49Vk0lSefEExPmtR+3D4MiOQ5ze9HFF8/Y3t0dc063ZcXK7zpfGjz\nO3FzNycYo/Qs8TBmZxZJrBvgN2h61mchYeX5NmIwrrtNPp1b2iUQnBBXAoGBAKj3\nb+CHINJ8EiGYYLvwvVy+0hfpiwhWst4f+mWFKKoFKwNcWlRWewaGI9DjPYaSeyUo\nYzxHVSEYisd2smKhQP2gk90KRwMTUU/6d7TWqvhsH3r1gzT1kbqiTEJaV3p65Upl\n+bk1sv0RPIl1KfGBQV6B8Ylfdc3fFPW5LX/zNmtxAoGAUYaXuolKuCRKNgdMx6qA\nQlxV9P1oehg3VPtZfn6BzKHmqYM8NVXAzWMiqK+8mwJwlpGi+c11s/XxfrgRxHeB\nhMjfeLuEvjChd0EEnPC4HcBazMGyMhI2jzPYfZ4WbaOu5enxV9kQQMWM4YR3fP9/\nu9W/y1bhTmzt4EMV7e2EbpA=\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@video-modeling-c46ff.iam.gserviceaccount.com",
  "client_id": "106411288685713044687",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40video-modeling-c46ff.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as any)
});

const db = admin.firestore();

const centerCode = 'KBC';

function removeAccents(str: string) {
  return str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'))
    .replace(/\s+/g, '') // Remove spaces
    .trim();
}

function generateSecurePassword() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

const rawChildrenData = [
  {"id": 1, "name": "Nguyễn Trường Long", "birthDay": "19/01/2020", "nickname": "", "teacher": "Cô Vy", "gender": "B"},
  {"id": 2, "name": "Nguyễn Đăng Khôi", "birthDay": "26/12/2018", "nickname": "", "teacher": "Cô Hồng Ngân", "gender": "B"},
  {"id": 3, "name": "Trương Thanh Phong", "birthDay": "13/02/2019", "nickname": "", "teacher": "Cô Hồng Ngân", "gender": "B"},
  {"id": 4, "name": "Dương Minh Khang", "birthDay": "26/01/2020", "nickname": "Rô", "teacher": "Cô Hồng Ngân", "gender": "B"},
  {"id": 5, "name": "Trương Thanh Lâm", "birthDay": "16/08/2021", "nickname": "", "teacher": "Cô Thảo", "gender": "B"},
  {"id": 6, "name": "Nguyễn Quý Minh Đức", "birthDay": "7/1/2021", "nickname": "", "teacher": "Cô Quỳnh", "gender": "B"},
  {"id": 7, "name": "Thi Phúc Khang", "birthDay": "26/01/2019", "nickname": "Đô la", "teacher": "Cô Quỳnh", "gender": "B"},
  {"id": 8, "name": "Lê Minh Khang", "birthDay": "8/10/2023", "nickname": "Toro", "teacher": "Cô Quỳnh", "gender": "B"},
  {"id": 9, "name": "Phạm Quang Thiên", "birthDay": "11/2/2024", "nickname": "", "teacher": "Cô Quỳnh", "gender": "B"},
  {"id": 10, "name": "Lại Thế Anh", "birthDay": "7/2/2022", "nickname": "Bo (KLC)", "teacher": "Cô Quỳnh", "gender": "B"},
  {"id": 11, "name": "Lê Doãn Bảo Long", "birthDay": "18/03/2024", "nickname": "Võ Tòng", "teacher": "Thầy Hoàng", "gender": "B"},
  {"id": 12, "name": "Mai Hoàng Bảo Trân", "birthDay": "26/01/2021", "nickname": "Sữa", "teacher": "Thầy Hoàng", "gender": "G"},
  {"id": 13, "name": "Nguyễn Tiến Phước", "birthDay": "13/09/2019", "nickname": "", "teacher": "Cô Nghi", "gender": "B"},
  {"id": 14, "name": "Lương Minh Bảo", "birthDay": "25/03/2020", "nickname": "Bòn Bon", "teacher": "Cô Hoa", "gender": "B"},
  {"id": 15, "name": "Phan Văn Trọng Nghĩa", "birthDay": "30/03/2024", "nickname": "Gà", "teacher": "Cô Hoa", "gender": "B"},
  {"id": 16, "name": "Vũ Đạt Phúc An", "birthDay": "8/6/2017", "nickname": "", "teacher": "Cô Hoa", "gender": "G"},
  {"id": 17, "name": "Nguyễn Hoàng Đăng Khoa", "birthDay": "27/04/2019", "nickname": "Lucas", "teacher": "Thầy Khiêm", "gender": "B"},
  {"id": 18, "name": "Trần Gia Phúc", "birthDay": "5/12/2019", "nickname": "Bo (TT)", "teacher": "Cô Tuyến", "gender": "B"},
  {"id": 19, "name": "Đặng Bình Minh Anh", "birthDay": "8/4/2019", "nickname": "Kem", "teacher": "Cô Mai An", "gender": "G"},
  {"id": 20, "name": "Lê Trung Khang", "birthDay": "26/12/2019", "nickname": "", "teacher": "Cô Trang", "gender": "B"},
  {"id": 21, "name": "Nguyễn Khải Ninh", "birthDay": "12/3/2015", "nickname": "Bon", "teacher": "Cô Huyền", "gender": "B"}
];

const teachers = [
  "Cô Vy", "Cô Hồng Ngân", "Cô Thảo", "Cô Quỳnh", "Thầy Hoàng", 
  "Cô Nghi", "Cô Hoa", "Thầy Khiêm", "Cô Tuyến", "Cô Mai An", 
  "Cô Trang", "Cô Huyền"
];

async function clearCollections() {
  console.log('Clearing existing collections...');
  const collections = ['users', 'children', 'teachers'];
  for (const col of collections) {
    const snapshot = await db.collection(col).get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

async function seed() {
  await clearCollections();
  console.log('Starting seeding...');

  const batch = db.batch();

  // 1. Seed Teachers
  const teacherMap = new Map();
  for (let i = 0; i < teachers.length; i++) {
    const tName = teachers[i];
    const tCleanName = removeAccents(tName.replace(/Cô |Thầy /g, ''));
    const customId = `GV_${centerCode}_${tCleanName}${String(i + 1).padStart(2, '0')}`;
    const password = generateSecurePassword();
    
    const teacherRef = db.collection('teachers').doc(customId);
    batch.set(teacherRef, {
      id: i + 1,
      name: tName,
      centerCode: centerCode,
      role: 'teacher'
    });

    const userRef = db.collection('users').doc(customId);
    batch.set(userRef, {
      customId,
      password,
      role: 'teacher',
      fullName: tName,
      centerCode: centerCode
    });

    teacherMap.set(tName, customId);
    console.log(`Teacher created: ${customId} | Password: ${password}`);
  }

  // 2. Seed Children and Parents
  for (const child of rawChildrenData) {
    const childId = String(child.id);
    const firstName = removeAccents(child.name.split(' ').pop() || '');
    const parentId = `PH_${firstName}_${child.gender}${String(child.id).padStart(2, '0')}`;
    const password = generateSecurePassword();

    const childRef = db.collection('children').doc(childId);
    batch.set(childRef, {
      id: child.id,
      name: child.name,
      nickname: child.nickname || `Bé ${child.name.split(' ').pop()}`,
      birthDay: child.birthDay,
      gender: child.gender,
      parentId: parentId,
      teacherId: teacherMap.get(child.teacher) || ''
    });

    const userRef = db.collection('users').doc(parentId);
    batch.set(userRef, {
      customId: parentId,
      password,
      role: 'parent',
      childId: childId,
      fullName: `Phụ huynh ${child.name}`,
      centerCode: centerCode
    });

    console.log(`Parent created: ${parentId} | Password: ${password} | Child: ${child.name}`);
  }

  await batch.commit();
  console.log('Seeding completed successfully!');
}

seed().catch(err => {
  console.error('Error seeding data:', err);
  process.exit(1);
});

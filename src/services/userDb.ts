import usersData from '../data/users.json';

interface User {
  id: string;
  handle: string;
  email?: string;
  phone?: string;
  cpf?: string;
  pix?: string;
}

class UserDbService {
  private users: User[];

  constructor() {
    this.users = usersData.users;
    console.log(`Loaded ${this.users.length} users from JSON`);
  }

  getUserById(id: string): User | null {
    return this.users.find(user => user.id === id) || null;
  }

  getUserByHandle(handle: string): User | null {
    const norm = handle.trim().toLowerCase();
    return this.users.find(user => user.handle.trim().toLowerCase() === norm) || null;
  }

  getUserByIdentifier(identifier: string): User | null {
    console.log('getUserByIdentifier - identificador recebido:', JSON.stringify(identifier));
    const norm = identifier.trim().toLowerCase();
    // Try to find by handle first
    const byHandle = this.getUserByHandle(norm);
    if (byHandle) {
      console.log('Encontrado por handle:', byHandle);
      return byHandle;
    }

    // Try to find by ID
    const byId = this.getUserById(identifier);
    if (byId) return byId;

    // Try to find by other fields
    return this.users.find(user => 
      (user.email && user.email.trim().toLowerCase() === norm) ||
      (user.phone && user.phone.trim() === identifier.trim()) ||
      (user.cpf && user.cpf.replace(/\D/g, '') === identifier.replace(/\D/g, '')) ||
      (user.pix && user.pix.trim().toLowerCase() === norm)
    ) || null;
  }

  getAllUsers(): User[] {
    return this.users;
  }
}

export const userDb = new UserDbService(); 
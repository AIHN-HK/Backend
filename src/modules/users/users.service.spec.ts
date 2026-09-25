import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

describe('UsersService', () => {
  let service: UsersService;
  let repository: UsersRepository;

  const mockUser = {
    id: '1',
    email: 'test@example.com',
    password: 'hashedPassword',
    firstName: 'John',
    lastName: 'Doe',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUsersRepository = {
    findById: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: mockUsersRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<UsersRepository>(UsersRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should return a user without password', async () => {
      mockUsersRepository.findById.mockResolvedValue(mockUser);

      const result = await service.findById('1');

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        isActive: mockUser.isActive,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      expect(result).not.toHaveProperty('password');
      expect(mockUsersRepository.findById).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUsersRepository.findById.mockResolvedValue(null);

      await expect(service.findById('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and return user without password', async () => {
      const updateDto = { firstName: 'Jane' };
      const updatedUser = { ...mockUser, ...updateDto };

      mockUsersRepository.findById.mockResolvedValue(mockUser);
      mockUsersRepository.update.mockResolvedValue(updatedUser);

      const result = await service.update('1', updateDto);

      expect(result.firstName).toBe('Jane');
      expect(result).not.toHaveProperty('password');
      expect(mockUsersRepository.update).toHaveBeenCalledWith('1', updateDto);
    });

    it('should throw NotFoundException when updating non-existent user', async () => {
      mockUsersRepository.findById.mockResolvedValue(null);

      await expect(service.update('999', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

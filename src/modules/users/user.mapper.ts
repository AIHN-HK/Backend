import { User } from '@prisma/client';
import { UserProfileResponseDto } from './dto/user-response';
import { Gender } from './dto/update-user.dto';

export function mapUserToProfileDto(user: User): UserProfileResponseDto {
  const currentYear = new Date().getFullYear();
  const yob = new Date(user.yob).getFullYear();

  return {
    fullname: user.fullname,
    age: currentYear - yob,
    phone: user.phone,
    address: user.address,
    gender: (user.gender as Gender) ?? Gender.OTHER,
    email: user.email,
    class: user.class,
  };
}

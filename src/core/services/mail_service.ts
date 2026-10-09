import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (process.env.NODE_ENV !== 'production') {
      this.transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT),
        secure: false,
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });
    } else {
      // 👉 PRODUCTION
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    }
  }

  async sendOtp(email: string, otp: string) {
    try {
      if (process.env.NODE_ENV !== 'production') {
        await this.transporter!.sendMail({
          from: process.env.MAIL_FROM,
          to: email,
          subject: 'Mã OTP xác thực',
          text: `OTP của bạn: ${otp} (hết hạn 10 phút)`,
        });
      } else {
        // PRODUCTION
        await sgMail.send({
          to: email,
          from: process.env.MAIL_FROM, // đã verify
          subject: 'Mã OTP xác thực',
          text: `OTP của bạn: ${otp} (hết hạn 10 phút)`,
        });
      }
    } catch {
      console.error('MAIL ERROR: email delivery failed');
      throw new InternalServerErrorException('Gửi email thất bại');
    }
  }
}

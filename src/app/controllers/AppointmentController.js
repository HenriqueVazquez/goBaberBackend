/* eslint-disable no-console */
import * as Yup from 'yup';
import {
  startOfHour,
  parseISO,
  isBefore,
  isAfter,
  format,
  subHours,
  setHours,
} from 'date-fns';
import pt from 'date-fns/locale/pt';
import User from '../models/User';
import File from '../models/File';
import Appointment from '../models/Appointment';
import Notification from '../schemas/Notification';
import CancellationMail from '../jobs/CancellationMail';

import Queue from '../../lib/Queue';

class AppointmentController {
  async index(req, res) {
    const { page = 1 } = req.query;

    const appointments = await Appointment.findAll({
      where: { user_id: req.userId, canceled_at: null },
      order: [['date', 'DESC']],
      limit: 5,
      offset: (page - 1) * 5,
      attributes: ['id', 'date', 'past', 'cancelable'],
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name'],
          include: [
            {
              model: File,
              as: 'avatar',
              attributes: ['id', 'path', 'url'],
            },
          ],
        },
      ],
    });
    console.log(appointments);
    return res.json(appointments);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      provider_id: Yup.number().required(),
      date: Yup.date().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ Erro: 'validation fails!' });
    }

    const { provider_id, date } = req.body;

    // verificando se é um usuario
    const idUser = req.userId;

    const isUser = await User.findOne({
      where: { id: idUser, provider: false },
    });

    if (!isUser) {
      return res.status(401).json({
        Erro: 'Only User can create appointments',
      });
    }

    // Verificar se provider_id é um provider

    const isProvider = await User.findOne({
      where: { id: provider_id, provider: true },
    });

    if (!isProvider) {
      return res.status(401).json({
        Erro: 'You can only create appointments with provider',
      });
    }

    // Verificando se a data já não passou

    const hourStart = startOfHour(parseISO(date));

    if (isBefore(hourStart, new Date())) {
      return res.status(400).json({ Erro: 'Past dates are not permitted!' });
    }

    if (
      isBefore(hourStart, setHours(hourStart, 7)) ||
      isAfter(hourStart, setHours(hourStart, 20))
    ) {
      return res.status(400).json({
        Erro: 'Informe uma data de agendamento, entre as 08:00 até as 20:00!',
      });
    }

    // verificando se a data esta valida para marcação

    const checkAvailability = await Appointment.findOne({
      where: {
        provider_id,
        canceled_at: null,
        date: hourStart,
      },
    });

    if (checkAvailability) {
      return res.status(400).json({ Erro: 'Appointment date is not avaible!' });
    }

    const appointment = await Appointment.create({
      user_id: req.userId,
      provider_id,
      date,
    });

    // notificar o prestador de serviço
    const user = await User.findByPk(req.userId);

    const formatterdDate = format(
      hourStart,
      "'dia' dd 'de' MMMM', às' H:mm'h'",
      { locale: pt }
    );

    await Notification.create({
      content: `Novo agendamento de ${user.name} para ${formatterdDate}`,
      user: provider_id,
    });

    return res.json(appointment);
  }

  async delete(req, res) {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['name', 'email'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['name'],
        },
      ],
    });

    if (appointment.user_id !== req.userId) {
      return res.status(401).json({
        Erro: 'You don`t have permission to cancel this appointment!',
      });
    }
    const dateWithSub = subHours(appointment.date, 2);

    if (isBefore(dateWithSub, new Date())) {
      return res.status(401).json({
        Erro: 'You can only cancel appointments 2 hours in advance.',
      });
    }
    if (appointment.canceled_at) {
      return res.status(401).json({
        Erro: 'This appointment has already been canceled',
      });
    }

    appointment.canceled_at = new Date();

    await appointment.save();

    await Queue.add(CancellationMail.key, {
      appointment,
    });

    return res.json(appointment);
  }
}

export default new AppointmentController();

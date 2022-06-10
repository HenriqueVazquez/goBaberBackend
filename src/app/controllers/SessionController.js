/* eslint-disable no-console */
import jwt from 'jsonwebtoken';
import * as Yup from 'yup';

import User from '../models/User';
import File from '../models/File';
import authConfig from '../../config/auth';

class SessionController {
  async store(req, res) {
    try {
      const schema = Yup.object().shape({
        email: Yup.string()
          .email('Digite um email valido.')
          .required('Email é obrigatorio para o login.'),
        password: Yup.string().required('Senha é obrigatoria para o login.'),
      });

      await schema.validate(req.body, {
        abortEarly: false,
      });
      const { email, password } = req.body;

      const user = await User.findOne({
        where: { email },
        include: [
          {
            model: File,
            as: 'avatar',
            attributes: ['id', 'path', 'url'],
          },
        ],
      });

      if (!user) {
        return res.status(401).json({ email: 'usuário não encontrado' });
      }

      if (!(await user.checkPassword(password))) {
        return res.status(401).json({ password: 'Senha não esta correta!' });
      }

      const { id, name, avatar, provider } = user;

      return res.json({
        user: {
          id,
          name,
          email,
          provider,
          avatar,
        },
        token: jwt.sign({ id }, authConfig.secret, {
          expiresIn: authConfig.expiresIn,
        }),
      });
    } catch (err) {
      const errorMessages = {};
      if (err instanceof Yup.ValidationError) {
        err.inner.forEach((error) => {
          errorMessages[error.path] = error.message;
        });

        return res.status(400).json(errorMessages);
      }

      return res.status(400).json({ errorMessages });
    }
  }
}

export default new SessionController();

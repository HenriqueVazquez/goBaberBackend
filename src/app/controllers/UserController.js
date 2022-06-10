import * as Yup from 'yup';
import User from '../models/User';
import File from '../models/File';

class UserController {
  async store(req, res) {
    try {
      const schema = Yup.object().shape({
        name: Yup.string().required('Nome é obrigatorio para o cadastro.'),
        email: Yup.string()
          .email()
          .required('Email é obrigatorio para o cadastro.'),
        password: Yup.string()
          .required()
          .min(6, 'A senha deve ter no mínimo 6 caracteres.'),
      });

      /* if (!(await schema.isValid(req.body))) {
        return res.status(400).json({ Erro: 'validation fails' });
      } */

      await schema.validate(req.body, {
        abortEarly: false,
      });

      const userExists = await User.findOne({
        where: { email: req.body.email },
      });

      if (userExists) {
        return res.status(400).json({ Erro: 'Usuario já cadastrado.' });
      }

      const { id, name, email, provider } = await User.create(req.body);

      return res.json({
        id,
        name,
        email,
        provider,
      });
    } catch (err) {
      if (err.errors.length === 1) {
        return res.status(400).json({ Erro: err.message });
      }
      const errorMessages = [];

      err.inner.forEach((error) => {
        errorMessages.push(error.message);
      });
      return res.status(400).json({ Erro: errorMessages });
    }
  }

  async update(req, res) {
    try {
      const schema = Yup.object().shape({
        name: Yup.string().min(1, 'O nome precisa ter no mínimo 1 caracter.'),
        email: Yup.string()
          .email('O e-mail informado não é válido.')
          .min(5, 'Um email valido precisa de no minimo 5 caracteres.'),

        oldPassword: Yup.string().min(
          6,
          'A senha deve ter no mínimo 6 caracteres.'
        ),
        password: Yup.string()
          .min(6, 'A senha deve ter no mínimo 6 caracteres')
          .when('oldPassword', (oldPassword, field) =>
            oldPassword
              ? field.required('A nova senha precisa ser informada')
              : field
          ),
        confirmPassword: Yup.string()
          .min(6, 'A confirmação de senha deve ter no mínimo 6 caracteres')
          .when('password', (password, field) =>
            password ? field.required().oneOf([Yup.ref('password')]) : field
          ),
      });

      await schema.validate(req.body, {
        abortEarly: false,
      });

      /* if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ Erro: `${schema}` });
    } */

      const { oldPassword } = req.body;
      const { email } = req.body;

      const user = await User.findByPk(req.userId);

      if (email && email !== user.email) {
        const userExists = await User.findOne({ where: { email } });

        if (userExists) {
          return res
            .status(400)
            .json({ email: 'Usuario já cadastrado com outra conta' });
        }
      }

      if (oldPassword && !(await user.checkPassword(oldPassword))) {
        return res
          .status(401)
          .json({ oldPassword: 'A senha não esta correta!' });
      }

      await user.update(req.body);

      const { id, name, avatar } = await User.findByPk(req.userId, {
        include: [
          {
            model: File,
            as: 'avatar',
            attributes: ['id', 'path', 'url'],
          },
        ],
      });

      return res.json({
        id,
        name,
        email,
        avatar,
      });
    } catch (err) {
      const errorMessages = {};
      if (err instanceof Yup.ValidationError) {
        err.inner.forEach((error) => {
          errorMessages[error.path] = error.message;
        });

        return res.status(400).json(errorMessages);
      }

      /* if (err.errors.length === 1) {
        return res.status(400).json({ Erro: err.message });
      }
      const errorMessages = [];

      err.inner.forEach((error) => {
        errorMessages.push(error.message);
      }); */
      return res.status(400).json({ errorMessages });
    }
  }
}

export default new UserController();

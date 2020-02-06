module.exports = {
  types: [
    {
      name: 'home',
      label: 'Home'
    },
    {
      name: 'object',
      label: 'Object'
    }
  ],
  park: [
    {
      slug: '/',
      published: true,
      _defaults: {
        title: 'Home',
        type: 'home'
      },
      _children: [
        {
          slug: '/object',
          type: 'object',
          trash: false,
          published: true
        }
      ]
    }
  ]
};
